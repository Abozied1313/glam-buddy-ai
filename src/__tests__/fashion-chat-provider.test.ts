import { describe, it, expect, vi } from 'vitest';
import { chatTextEvents, deliverChat, DIRECT_CHAT_MODEL, openDirectChat, usesDirectChat } from '../../supabase/functions/fashion-chat/provider';
import { CHAT_LIMIT, consumeQuota } from '../../supabase/functions/_shared/quota';

const frame = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const textFrame = (text: string) => frame({ candidates: [{ content: { parts: [{ text }] } }] });
const stop = frame({ candidates: [{ finishReason: 'STOP' }] });
function source(text: string, byteSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < bytes.length; i += byteSize) controller.enqueue(bytes.slice(i, i + byteSize));
    controller.close();
  } });
}
const hooks = () => ({ emit: vi.fn(), save: vi.fn().mockResolvedValue(undefined), refund: vi.fn().mockResolvedValue(undefined), done: vi.fn() });

describe('dedicated fashion chat provider', () => {
  it('keeps Gateway only while the dedicated key is absent (never treats a broken configured key as fallback)', () => {
    expect(usesDirectChat(undefined)).toBe(false);
    expect(usesDirectChat('synthetic-test-credential')).toBe(true);
    expect(usesDirectChat('')).toBe(true);
  });
  it('uses the verified free-tier text model, header-only dedicated credential and native history roles', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 200 }));
    const messages = [{ role: 'system', content: 'Text-only fashion advice' }, { role: 'user', content: 'سؤال سابق' }, { role: 'assistant', content: 'نصيحة' }, { role: 'user', content: 'سؤال جديد' }];
    await openDirectChat(messages, 'synthetic-test-credential', fetcher);
    expect(DIRECT_CHAT_MODEL).toBe('gemini-3.5-flash-lite');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse');
    expect(init?.headers).toEqual({ 'x-goog-api-key': 'synthetic-test-credential', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({ systemInstruction: { parts: [{ text: messages[0].content }] }, contents: [
      { role: 'user', parts: [{ text: 'سؤال سابق' }] }, { role: 'model', parts: [{ text: 'نصيحة' }] }, { role: 'user', parts: [{ text: 'سؤال جديد' }] },
    ] });
  });
  it('does not retry or fallback on Gemini rate limits or network failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 429 }));
    expect((await openDirectChat([], 'synthetic-test-credential', fetcher)).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockRejectedValue(new Error('network'));
    await expect(openDirectChat([], 'synthetic-test-credential', fetcher)).rejects.toThrow('network');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('adapts split UTF-8 Arabic, CRLF, multiple parts and skips thought text', async () => {
    const event = frame({ candidates: [{ content: { parts: [{ text: 'private thought', thought: true }, { text: 'قميص ' }, { text: 'أزرق' }] } }] });
    const result: string[] = [];
    for await (const text of chatTextEvents(source(event + stop), true)) result.push(text);
    expect(result).toEqual(['قميص ', 'أزرق']);
  });
  it('handles a final event without a newline', async () => {
    const result: string[] = [];
    for await (const text of chatTextEvents(source(textFrame('نصيحة') + stop.trim()), true)) result.push(text);
    expect(result).toEqual(['نصيحة']);
  });
  it('retains Gateway delta adaptation', async () => {
    const result: string[] = [];
    for await (const text of chatTextEvents(source(frame({ choices: [{ delta: { content: 'نصيحة' } }] }) + 'data: [DONE]\n\n'), false)) result.push(text);
    expect(result).toEqual(['نصيحة']);
  });
  it('saves a completed reply before DONE without refunding', async () => {
    const h = hooks();
    await deliverChat(source(textFrame('قميص أزرق') + stop), true, h);
    expect(h.emit).toHaveBeenCalledWith({ choices: [{ delta: { content: 'قميص أزرق' } }] });
    expect(h.save).toHaveBeenCalledWith('قميص أزرق');
    expect(h.done).toHaveBeenCalledOnce();
    expect(h.refund).not.toHaveBeenCalled();
    expect(h.save.mock.invocationCallOrder[0]).toBeLessThan(h.done.mock.invocationCallOrder[0]);
  });
  it.each([
    frame({ error: { message: 'synthetic failure' } }),
    frame({ promptFeedback: { blockReason: 'SAFETY' } }),
    'data: broken-json\n\n',
    stop,
  ])('refunds a failed or empty response before any visible text', async stream => {
    const h = hooks();
    await deliverChat(source(stream), true, h);
    expect(h.refund).toHaveBeenCalledOnce();
    expect(h.save).not.toHaveBeenCalled();
    expect(h.done).not.toHaveBeenCalled();
    expect(h.emit).toHaveBeenCalledWith({ error: 'توقف الرد قبل اكتماله.' });
  });
  it.each([textFrame('جزء من الرد'), textFrame('جزء من الرد') + frame({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), textFrame('جزء من الرد') + frame({ error: {} })])('saves partial replies as incomplete without refund or DONE', async stream => {
    const h = hooks();
    await deliverChat(source(stream), true, h);
    expect(h.save).toHaveBeenCalledWith('جزء من الرد\n\n[توقف الرد قبل اكتماله]');
    expect(h.refund).not.toHaveBeenCalled();
    expect(h.done).not.toHaveBeenCalled();
  });
  it('does not claim success or refund delivered text if persistence fails', async () => {
    const h = hooks(); h.save.mockRejectedValue(new Error('database'));
    await deliverChat(source(textFrame('نصيحة') + stop), true, h);
    expect(h.done).not.toHaveBeenCalled();
    expect(h.refund).not.toHaveBeenCalled();
    expect(h.emit).toHaveBeenLastCalledWith({ error: 'توقف الرد قبل اكتماله.' });
  });
  it('retains the 15-message server quota and fails closed on quota errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await consumeQuota({ rpc }, 'synthetic-owner', 'chat', CHAT_LIMIT)).toBeNull();
    expect(rpc).toHaveBeenCalledWith('consume_quota', { _user_id: 'synthetic-owner', _kind: 'chat', _limit: 15 });
    rpc.mockResolvedValue({ data: null, error: new Error('database') });
    await expect(consumeQuota({ rpc }, 'synthetic-owner', 'chat', CHAT_LIMIT)).rejects.toMatchObject({ status: 503 });
  });
});