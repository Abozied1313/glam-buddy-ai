import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { consumeQuota, refundQuota, RequestError, CHAT_LIMIT, EXHAUSTED_MESSAGE } from '../_shared/quota.ts';

const CHAT_MODEL = 'google/gemini-3.8-flash'; // Confirmed in the Lovable AI Gateway catalog
const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const GENERIC_ERROR = 'تعذر الرد الآن. حاول لاحقاً.';
const SYSTEM = `You are The Special Style fashion consultant. Reply in the user's language, usually Arabic, concise and friendly, using markdown. Text-only advice on outfits, colors, fabrics, fit and hairstyles. Use personalized varied colors, not default black/dark olive. Never infer religion. Hijab/modesty is only an explicitly requested styling preference. Never claim to generate images; direct image requests to ولّد إطلالتي on the analysis page.`;
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  let eventId: string | null = null, owner: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    if (req.method !== 'POST') return json({ error: 'طريقة الطلب غير مدعومة.' }, 405);
    const header = req.headers.get('Authorization');
    if (!header?.startsWith('Bearer ')) return json({ error: 'يجب تسجيل الدخول.' }, 401);
    admin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const { data: { user }, error: authError } = await admin.auth.getUser(header.slice(7));
    if (authError || !user) return json({ error: 'يجب تسجيل الدخول.' }, 401);
    owner = user.id;
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 12000) return json({ error: 'الطلب كبير جداً.' }, 413);
    let body: { message?: unknown };
    try { body = JSON.parse(raw); } catch { return json({ error: 'طلب غير صالح.' }, 400); }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 2000) return json({ error: 'الرسالة يجب أن تكون بين 1 و2000 حرف.' }, 400);
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'خدمة المحادثة غير مهيأة حالياً.' }, 503);

    eventId = await consumeQuota(admin, owner, 'chat', CHAT_LIMIT);
    if (!eventId) return json({ error: EXHAUSTED_MESSAGE.chat }, 429);

    const { data: history, error: historyError } = await admin.from('chat_messages').select('role,content').eq('user_id', owner).order('created_at', { ascending: false }).limit(30);
    if (historyError) throw historyError;
    const messages = [
      { role: 'system', content: SYSTEM },
      ...(history || []).reverse().map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: message },
    ];
    const upstream = await fetch(GATEWAY_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CHAT_MODEL, messages, stream: true }), signal: AbortSignal.timeout(120000),
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.error('chat_upstream', upstream.status, upstream.status === 404 || /model/i.test(detail) ? 'model_error' : '');
      if (upstream.status === 429) throw new RequestError(429, 'الخدمة مشغولة الآن، حاول بعد قليل.');
      if (upstream.status === 402) throw new RequestError(402, 'تعذر الرد الآن بسبب نفاد رصيد الخدمة.');
      throw new RequestError(502, GENERIC_ERROR);
    }
    const { error: saveUser } = await admin.from('chat_messages').insert({ user_id: owner, role: 'user', content: message });
    if (saveUser) throw saveUser;

    const client = admin, userId = owner, source = upstream.body, usedId = eventId;
    eventId = null;
    const encoder = new TextEncoder(), decoder = new TextDecoder();
    let disconnected = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = '', buffer = '';
        const emit = (data: unknown) => { if (!disconnected) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
        try {
          const reader = source.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1);
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (payload === '[DONE]') continue;
              try {
                const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta) { full += delta; emit({ choices: [{ delta: { content: delta } }] }); }
              } catch { /* partial JSON line: ignore */ }
            }
          }
          if (!full.trim()) throw new Error('empty');
          const { error } = await client.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: full.slice(0, 8000) });
          if (error) throw error;
          if (!disconnected) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch {
          if (full.trim()) await client.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: full.slice(0, 7900) + '\n\n[توقف الرد قبل اكتماله]' });
          else await refundQuota(client, userId, usedId);
          emit({ error: 'توقف الرد قبل اكتماله.' });
        } finally {
          if (!disconnected) controller.close();
        }
      },
      cancel() { disconnected = true; },
    });
    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (admin && owner && eventId) await refundQuota(admin, owner, eventId);
    console.error('chat_failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: error instanceof RequestError ? error.message : GENERIC_ERROR }, error instanceof RequestError ? error.status : 500);
  }
});
