import { test } from "node:test";
import assert from "node:assert/strict";
import { createImageServer } from "./server.mjs";

const user = "11111111-1111-4111-8111-111111111111";
const analysis = "22222222-2222-4222-8222-222222222222";
const path = `${user}/original.jpg`;
const config = { project: "credited-project", model: "gemini-nano-banana-2.1", supabaseUrl: "https://app.supabase.co", supabaseAnonKey: "public-anon" };

async function run(t, fetcher, body, authorization = "Bearer user-jwt") {
  const server = createImageServer(config, fetcher);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return fetch(`http://127.0.0.1:${server.address().port}/edit`, {
    method: "POST", headers: authorization ? { Authorization: authorization } : {},
    body: JSON.stringify(body),
  });
}

const validBody = { analysisId: analysis, storagePath: path, prompt: "Edit only clothes; preserve face and body." };
test("unauthenticated callers cannot reach Google", async t => {
  const result = await run(t, () => { throw new Error("Must not call upstream"); }, validBody, null);
  assert.equal(result.status, 401);
});
test("another user's image is rejected before storage or Google access", async t => {
  let calls = 0;
  const result = await run(t, async () => { calls++; return Response.json({ id: user }); }, { ...validBody, storagePath: "another-user/photo.jpg" });
  assert.equal(result.status, 400);
  assert.equal(calls, 1);
});
test("analysis ownership and image binding are required", async t => {
  const result = await run(t, async url => url.includes("/auth/") ? Response.json({ id: user }) : Response.json([]), validBody);
  assert.equal(result.status, 403);
});
test("edits the stored original through the credited Cloud API using service identity", async t => {
  const calls = [];
  const result = await run(t, async (url, options) => {
    calls.push(url);
    if (url.includes("/auth/")) return Response.json({ id: user });
    if (url.includes("/rest/")) return Response.json([{ id: analysis, image_url: `${config.supabaseUrl}/storage/v1/object/sign/analysis-images/${path}?token=private` }]);
    if (url.includes("/storage/")) return new Response("original-image", { headers: { "Content-Type": "image/jpeg" } });
    if (url.includes("metadata.google.internal")) return Response.json({ access_token: "short-lived-cloud-token", expires_in: 3600 });
    assert.equal(url, "https://aiplatform.googleapis.com/v1/projects/credited-project/locations/global/publishers/google/models/gemini-nano-banana-2.1:generateContent");
    assert.equal(options.headers.Authorization, "Bearer short-lived-cloud-token");
    const body = JSON.parse(options.body);
    assert.equal(Buffer.from(body.contents[0].parts[1].inlineData.data, "base64").toString(), "original-image");
    assert.equal(body.generationConfig.temperature, undefined);
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "ZWRpdGVk" } }] } }] });
  }, validBody);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).dataUri, "data:image/png;base64,ZWRpdGVk");
  assert.equal(calls.length, 5);
});
test("a text-only model response cannot be reported as a generated image", async t => {
  const result = await run(t, async url => {
    if (url.includes("/auth/")) return Response.json({ id: user });
    if (url.includes("/rest/")) return Response.json([{ image_url: `${config.supabaseUrl}/storage/v1/object/sign/analysis-images/${path}` }]);
    if (url.includes("/storage/")) return new Response("image", { headers: { "Content-Type": "image/jpeg" } });
    if (url.includes("metadata.google.internal")) return Response.json({ access_token: "token", expires_in: 3600 });
    return Response.json({ candidates: [{ content: { parts: [{ text: "Cannot edit this image" }] } }] });
  }, validBody);
  assert.equal(result.status, 502);
});
