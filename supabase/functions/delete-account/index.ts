import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const BUCKET = 'analysis-images';

// deno-lint-ignore no-explicit-any
async function listAll(bucket: any, prefix: string, out: string[]) {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(prefix, { limit: 100, offset });
    if (error) throw new Error('storage_list');
    for (const item of data || []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) out.push(path); else await listAll(bucket, path, out);
    }
    if (!data || data.length < 100) break;
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'طريقة غير مدعومة.' }, 405);
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return json({ error: 'سجّل الدخول أولاً.' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  const { data: claims, error: claimsError } = await admin.auth.getClaims(header.slice(7));
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return json({ error: 'سجّل الدخول أولاً.' }, 401);
  try {
    // Only the caller's own data: every path and row is scoped to the verified JWT subject.
    const bucket = admin.storage.from(BUCKET);
    const paths: string[] = [];
    await listAll(bucket, userId, paths);
    await listAll(bucket, `generated/${userId}`, paths);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await bucket.remove(paths.slice(i, i + 100));
      if (error) throw new Error('storage_remove');
    }
    for (const table of ['favorites', 'chat_messages', 'usage_events', 'style_analyses', 'profiles', 'user_roles']) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) throw new Error(`delete_${table}`);
    }
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) throw new Error('delete_auth');
    return json({ success: true }, 200);
  } catch (error) {
    console.error('delete_account_failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'لم يكتمل حذف الحساب. حاول مرة أخرى.' }, 500);
  }
});
