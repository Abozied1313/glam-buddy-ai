// Verified 2026-11-11: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
// Free-tier text input/output: https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite
// The credential's Google project must remain on the free tier; REST cannot force billing tier.
export const DIRECT_CHAT_MODEL = 'gemini-3.5-flash-lite';
type Message = { role: string; content: string };

/** A configured (even invalid/empty) dedicated secret never falls back to paid Gateway. */
export function usesDirectChat(key: string | undefined): boolean {
  return key !== undefined;
}

export async function openDirectChat(messages: Message[], key: string, fetcher: typeof fetch = fetch) {
  if (!key.trim()) throw new Error('Chat credential is not configured');
  return fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_CHAT_MODEL}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: messages.find(m => m.role === 'system')?.content || '' }] },
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }],
      })),
    }),
    signal: AbortSignal.timeout(120000),
  });
}

/** Adapts native Gemini SSE while leaving the legacy Gateway delta parsing intact. */
export async function* chatTextEvents(source: ReadableStream<Uint8Array>, direct: boolean) {
  const reader = source.getReader(), decoder = new TextDecoder();
  let buffer = '', stopped = false;
  const parse = (line: string): string[] => {
    if (!line.trim().startsWith('data:')) return [];
    const payload = line.trim().slice(5).trim();
    if (payload === '[DONE]') return [];
    if (!direct) {
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        return typeof delta === 'string' && delta ? [delta] : [];
      } catch { return []; }
    }
    const event = JSON.parse(payload);
    if (event.error || event.promptFeedback?.blockReason) throw new Error('Chat provider rejected response');
    const candidate = event.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Incomplete chat response');
    if (candidate?.finishReason === 'STOP') stopped = true;
    const result: string[] = [];
    for (const part of candidate?.content?.parts || []) {
      if (typeof part.text === 'string' && !part.thought) result.push(part.text);
    }
    return result;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        for (const text of parse(line)) yield text;
      }
      if (done) break;
    }
    if (direct && buffer.trim()) for (const text of parse(buffer)) yield text;
    if (direct && !stopped) throw new Error('Incomplete chat stream');
  } finally { reader.releaseLock(); }
}

type StreamHooks = {
  emit: (data: unknown) => void;
  save: (content: string) => Promise<void>;
  refund: () => Promise<void>;
  done: () => void;
};

/** Preserve successful/partial persistence and refund only when no visible text arrived. */
export async function deliverChat(source: ReadableStream<Uint8Array>, direct: boolean, hooks: StreamHooks) {
  let full = '';
  try {
    for await (const delta of chatTextEvents(source, direct)) {
      full += delta;
      hooks.emit({ choices: [{ delta: { content: delta } }] });
    }
    if (!full.trim()) throw new Error('empty');
    await hooks.save(full.slice(0, 8000));
    hooks.done();
  } catch {
    if (full.trim()) {
      try { await hooks.save(full.slice(0, 7900) + '\n\n[توقف الرد قبل اكتماله]'); }
      catch { /* Do not signal completion or refund a delivered partial response. */ }
    } else await hooks.refund();
    hooks.emit({ error: 'توقف الرد قبل اكتماله.' });
  }
}