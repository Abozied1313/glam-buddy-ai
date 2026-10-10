import http from "node:http";
import { pathToFileURL } from "node:url";

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function createImageServer(config, fetcher = fetch) {
  const activeUsers = new Set();
  let googleToken;
  let tokenExpires = 0;
  const send = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const supabase = async (path, authorization) => fetcher(`${config.supabaseUrl}${path}`, {
    headers: { apikey: config.supabaseAnonKey, Authorization: authorization },
    signal: AbortSignal.timeout(15000),
  });

  return http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { status: "ok", provider: "google-cloud", model: config.model, project: config.project });
    }
    if (req.method !== "POST" || req.url !== "/edit") return send(res, 404, { error: "Not found" });
    let userId;
    let acquired = false;
    try {
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith("Bearer ")) return send(res, 401, { error: "Authentication required" });
      // Validate the caller against this app's Auth service, never just decode a JWT.
      const auth = await supabase("/auth/v1/user", authorization);
      if (!auth.ok) return send(res, 401, { error: "Invalid authentication" });
      userId = (await auth.json()).id;
      if (!UUID.test(userId || "")) return send(res, 401, { error: "Invalid authentication" });

      let body = "";
      for await (const chunk of req) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > 24000) return send(res, 413, { error: "Request too large" });
      }
      let input;
      try { input = JSON.parse(body); } catch { return send(res, 400, { error: "Invalid request" }); }
      const { storagePath, analysisId, prompt } = input;
      if (!UUID.test(analysisId || "") || typeof prompt !== "string" || !prompt.trim() || prompt.length > 16000 ||
          typeof storagePath !== "string" || storagePath.split("/")[0] !== userId ||
          storagePath.includes("..") || storagePath.length > 500) {
        return send(res, 400, { error: "Invalid edit request" });
      }
      // The edit must belong to an existing analysis owned by the authenticated caller.
      const analysisResponse = await supabase(`/rest/v1/style_analyses?id=eq.${analysisId}&user_id=eq.${userId}&select=id,image_url`, authorization);
      if (!analysisResponse.ok) return send(res, 403, { error: "Analysis access denied" });
      const analyses = await analysisResponse.json();
      const analysis = analyses[0];
      if (!analysis) return send(res, 403, { error: "Analysis access denied" });
      const storedPath = new URL(analysis.image_url).pathname.split("/analysis-images/")[1];
      if (!storedPath || decodeURIComponent(storedPath) !== storagePath) return send(res, 403, { error: "Image access denied" });
      if (activeUsers.has(userId)) return send(res, 429, { error: "An image edit is already running" });
      activeUsers.add(userId);
      acquired = true;

      const imageResponse = await supabase(`/storage/v1/object/authenticated/analysis-images/${storagePath.split("/").map(encodeURIComponent).join("/")}`, authorization);
      if (!imageResponse.ok) return send(res, 403, { error: "Image access denied" });
      const mimeType = imageResponse.headers.get("content-type")?.split(";")[0];
      if (!IMAGE_TYPES.has(mimeType)) return send(res, 415, { error: "Unsupported image type" });
      const declaredSize = Number(imageResponse.headers.get("content-length"));
      if (declaredSize > MAX_IMAGE_BYTES) return send(res, 413, { error: "Image too large" });
      const chunks = [];
      let size = 0;
      for await (const chunk of imageResponse.body) {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) return send(res, 413, { error: "Image too large" });
        chunks.push(Buffer.from(chunk));
      }
      if (!size) return send(res, 400, { error: "Empty image" });
      // Cloud Run supplies short-lived credentials for the service identity; no Google key is stored.
      if (!googleToken || Date.now() >= tokenExpires) {
        const credentials = await fetcher("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
          headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(5000),
        });
        if (!credentials.ok) throw new Error("Cloud identity unavailable");
        const token = await credentials.json();
        if (!token.access_token || !token.expires_in) throw new Error("Cloud identity unavailable");
        googleToken = token.access_token;
        tokenExpires = Date.now() + (token.expires_in - 60) * 1000;
      }
      const modelUrl = `https://aiplatform.googleapis.com/v1/projects/${config.project}/locations/global/publishers/google/models/${config.model}:generateContent`;
      const generation = await fetcher(modelUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: prompt },
            { inlineData: { mimeType, data: Buffer.concat(chunks).toString("base64") } },
          ] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"], candidateCount: 1 },
        }),
        signal: AbortSignal.timeout(180000),
      });
      if (!generation.ok) {
        console.error(JSON.stringify({ event: "cloud_image_error", status: generation.status, model: config.model, project: config.project }));
        return send(res, generation.status === 429 ? 429 : 502, { error: "Google Cloud image generation failed" });
      }
      const result = await generation.json();
      const image = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith("image/"))?.inlineData;
      if (!image?.data) return send(res, 502, { error: "Google Cloud returned no image" });
      console.log(JSON.stringify({ event: "cloud_image_generated", model: config.model, project: config.project }));
      return send(res, 200, { dataUri: `data:${image.mimeType};base64,${image.data}`, provider: "google-cloud", model: config.model, project: config.project });
    } catch (error) {
      console.error(JSON.stringify({ event: "image_editor_error", kind: error.name }));
      return send(res, 502, { error: "Image editing is temporarily unavailable" });
    } finally {
      if (acquired) activeUsers.delete(userId);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = {
    project: process.env.GOOGLE_CLOUD_PROJECT,
    model: process.env.GOOGLE_IMAGE_MODEL || "gemini-nano-banana-2.1",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  };
  if (!config.project || !config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Missing server configuration");
  createImageServer(config).listen(Number(process.env.PORT || 8080), "0.0.0.0");
}
