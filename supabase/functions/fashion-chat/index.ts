import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DAILY_CHAT_LIMIT = 15;
const MODEL = "google/gemini-3.5-flash";
const SYSTEM = `You are "The Special Style" fashion consultant. Reply in the user's language (usually Arabic), concise and friendly, using markdown.
Give text-only advice on outfits, color matching, fabrics, fit, occasions and hairstyles for men and women. Suggest varied, personalized colors (never default to black or dark olive).
You cannot create, render or edit images. Never claim to generate an image. If the user wants to see a look, tell them to press the "Generate My Look" (ولّد إطلالتي) button on the analysis page.`;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "يجب تسجيل الدخول" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "يجب تسجيل الدخول" }, 401);

    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 2000) return json({ error: "الرسالة يجب أن تكون بين 1 و2000 حرف" }, 400);

    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await admin.from("usage_events").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("kind", "chat").gte("created_at", since);
    if ((count ?? 0) >= DAILY_CHAT_LIMIT) return json({ error: "استهلكت 15 رسالة اليوم. يتجدد رصيدك تلقائياً خلال 24 ساعة." }, 429);

    const { data: history, error: hErr } = await admin.from("chat_messages").select("role, content")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (hErr) throw hErr;

    const { error: insErr } = await admin.from("chat_messages").insert({ user_id: user.id, role: "user", content: message });
    if (insErr) throw insErr;
    const { error: uErr } = await admin.from("usage_events").insert({ user_id: user.id, kind: "chat" });
    if (uErr) throw uErr;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [{ role: "system", content: SYSTEM }, ...(history || []).reverse(), { role: "user", content: message }],
      }),
    });
    if (!upstream.ok || !upstream.body) {
      console.error("Gateway error", upstream.status);
      const msg = upstream.status === 402 ? "انتهى رصيد الذكاء الاصطناعي للتطبيق مؤقتاً." :
        upstream.status === 429 ? "ضغط كبير الآن، حاول بعد قليل." : "تعذر الرد الآن، حاول مرة أخرى.";
      return json({ error: msg }, upstream.status === 402 || upstream.status === 429 ? upstream.status : 502);
    }

    let full = "";
    let buffer = "";
    const decoder = new TextDecoder();
    const stream = upstream.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          try { full += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ""; } catch { /* partial */ }
        }
      },
      async flush() {
        if (!full.trim()) return;
        const { error } = await admin.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: full.slice(0, 8000) });
        if (error) console.error("Assistant save failed:", error.message);
      },
    }));
    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("fashion-chat error", e);
    return json({ error: "حدث خطأ، حاول مرة أخرى." }, 500);
  }
});
