import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
export class RequestError extends Error {
 constructor(public status: number, message: string) { super(message); }
}
export async function fingerprint(value: unknown) {
 const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function reserve(client: SupabaseClient, user: string, kind: string, request: string, value: unknown, analysis: string | null = null) {
 if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(request || '')) throw new RequestError(400,'معرّف الطلب غير صالح.');
 const { data, error } = await client.rpc('reserve_quota', { p_user:user,p_kind:kind,p_request:request,p_fingerprint:await fingerprint(value),p_analysis:analysis });
 if (error || !data) throw new RequestError(503,'تعذر التحقق من الحصة؛ لم يبدأ طلب جديد.');
 if (data.status==='exhausted') throw new RequestError(429,`نفدت الحصة. الإتاحة التالية: ${new Date(data.available_at).toLocaleString('ar-EG',{timeZone:'UTC'})} UTC`);
 if (data.status==='completed') return { id:data.id,replay:data.result };
 if (data.status!=='reserved') throw new RequestError(409,'هذا الطلب سبق تنفيذه أو لا تزال نتيجته غير مؤكدة؛ لن نكرره تلقائياً.');
 return { id:data.id,replay:null };
}
export async function finish(client: SupabaseClient,user: string,id: string,state: 'completed'|'released'|'uncertain',result: unknown=null) {
 const { error } = await client.rpc('finish_quota',{p_user:user,p_id:id,p_state:state,p_result:result});
 if (error) throw new RequestError(503,'تعذر تأكيد حالة الطلب؛ لن تتم إعادة تشغيله تلقائياً.');
}
