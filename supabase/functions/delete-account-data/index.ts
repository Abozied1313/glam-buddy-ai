import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { deleteOwnedData } from '../_shared/delete-data.ts';
const json=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 try{
  if(req.method!=='POST')return json({error:'طريقة غير مدعومة.'},405);
  const header=req.headers.get('Authorization');
  if(!header?.startsWith('Bearer '))return json({error:'سجّل الدخول أولاً.'},401);
  const client=createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  const {data:{user},error}=await client.auth.getUser(header.slice(7));
  if(error || !user)return json({error:'سجّل الدخول أولاً.'},401);
  const raw=await req.text();if(raw.length>2000)return json({error:'طلب غير صالح.'},400);
  const {scope,analysisId,confirmation}=JSON.parse(raw);
  if(!['analysis','chat','data','account'].includes(scope) || confirmation!=='حذف')return json({error:'تأكيد الحذف مطلوب.'},400);
  if(scope==='analysis' && !/^[\da-f-]{36}$/i.test(analysisId || ''))return json({error:'التحليل غير صالح.'},400);
  if(['account','data'].includes(scope)){
   const {data:claims,error:claimsError}=await client.auth.getClaims(header.slice(7));
   const lastSignIn=new Date(user.last_sign_in_at || 0).getTime();
   if(claimsError || !claims?.claims || Date.now()-lastSignIn>10*60*1000)return json({error:'لحماية حسابك، سجّل الخروج ثم ادخل مجدداً قبل الحذف خلال ١٠ دقائق.'},403);
  }
  await deleteOwnedData(client,user.id,scope,scope==='analysis'?analysisId:null);
  return json({success:true},200);
 }catch(error){console.error('deletion_failed');return json({error:error instanceof Error?error.message:'لم يكتمل الحذف.'},503);}
});
