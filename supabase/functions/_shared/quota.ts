// deno-lint-ignore-file no-explicit-any
export class RequestError extends Error {
 constructor(public status: number, message: string) { super(message); }
}
export const RENDER_LIMIT = 3;
export const CHAT_LIMIT = 15;
export const EXHAUSTED_MESSAGE: Record<'render'|'chat',string> = {
 render: 'لقد استخدمت حصتك اليومية (3 صور). يمكنك المحاولة مجدداً بعد 24 ساعة من أول توليد.',
 chat: 'لقد استخدمت حصتك اليومية من رسائل المحادثة (15 رسالة). حاول لاحقاً.',
};
/** Atomically consumes one quota unit; returns the usage event id, or null when exhausted. Fails closed. */
export async function consumeQuota(client: any, user: string, kind: 'render'|'chat', limit: number): Promise<string|null> {
 const { data, error } = await client.rpc('consume_quota', { _user_id: user, _kind: kind, _limit: limit });
 if (error) throw new RequestError(503, 'تعذر التحقق من الحصة؛ لم يبدأ الطلب.');
 return (data as string | null) ?? null;
}
/** Refunds a consumed unit (idempotent: deleting a missing row is a no-op). */
export async function refundQuota(client: any, user: string, id: string) {
 const { error } = await client.rpc('refund_quota', { _user_id: user, _event_id: id });
 if (error) console.error('quota_refund_failed');
}
