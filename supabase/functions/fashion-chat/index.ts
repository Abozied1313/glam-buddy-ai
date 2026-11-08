import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { reserve,finish,RequestError } from '../_shared/quota.ts';
import { geminiModel,geminiTextEvents } from '../_shared/gemini.ts';
const SYSTEM=`You are The Special Style fashion consultant. Reply in the user's language, usually Arabic, concise and friendly, using markdown. Text-only advice on outfits, colors, fabrics, fit and hairstyles. Use personalized varied colors, not default black/dark olive. Never infer religion. Hijab/modesty is only an explicitly requested styling preference. Never claim to generate images; direct image requests to ولّد إطلالتي on the analysis page.`;
const json=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 let id:string|null=null,owner:string|null=null;
 let admin:ReturnType<typeof createClient>|null=null;
 let outcome:'released'|'uncertain'='released';
 try {
  if(req.method!=='POST') return json({error:'طريقة الطلب غير مدعومة.'},405);
  const header=req.headers.get('Authorization');
  if(!header?.startsWith('Bearer ')) return json({error:'يجب تسجيل الدخول.'},401);
  admin=createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  const {data:{user},error:authError}=await admin.auth.getUser(header.slice(7));
  if(authError || !user) return json({error:'يجب تسجيل الدخول.'},401);
  owner=user.id;
  const raw=await req.text();
  if(new TextEncoder().encode(raw).length>12000) return json({error:'الطلب كبير جداً.'},413);
  const body=JSON.parse(raw), message=typeof body.message==='string'?body.message.trim():'';
  if(!message || message.length>2000) return json({error:'الرسالة يجب أن تكون بين 1 و2000 حرف.'},400);
  const key=Deno.env.get('GEMINI_API_KEY');
  if(!key) return json({error:'خدمة المحادثة غير مهيأة حالياً.'},503);
  const model=geminiModel('GEMINI_CHAT_MODEL');
  const reservation=await reserve(admin,owner,'chat',body.requestId,{message});
  if(reservation.replay) return json(reservation.replay,200);
  id=reservation.id;
  const {data:history,error:historyError}=await admin.from('chat_messages').select('role,content').eq('user_id',owner).order('created_at',{ascending:false}).limit(30);
  if(historyError) throw historyError;
  const contents=(history || []).reverse().map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
  contents.push({role:'user',parts:[{text:message}]});
  outcome='uncertain';
  const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,{
   method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
   body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents}),signal:AbortSignal.timeout(130000),
  });
  if(!upstream.ok || !upstream.body) {
   if([400,401,403,404,429].includes(upstream.status)) outcome='released';
   throw new RequestError(upstream.status===429?429:502,'تعذر الرد لدى Gemini. حاول لاحقاً أو راجع إعداد الخدمة.');
  }
  const {error:saveUser}=await admin.from('chat_messages').insert({user_id:owner,role:'user',content:message});
  if(saveUser) throw saveUser;
  const client=admin,userId=owner,reservationId=id,source=upstream.body;
  const encoder=new TextEncoder(); let disconnected=false;
  const stream=new ReadableStream<Uint8Array>({
   async start(controller){
    let full=''; let succeeded=false;
    const emit=(data:unknown)=>{if(!disconnected) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));};
    try {
     for await(const delta of geminiTextEvents(source)) {full+=delta;emit({choices:[{delta:{content:delta}}]});}
     if(!full.trim()) throw new Error('Empty response');
     const {error}=await client.from('chat_messages').insert({user_id:userId,role:'assistant',content:full.slice(0,8000)});
     if(error) throw error;
     await finish(client,userId,reservationId,'completed',{content:full.slice(0,8000)});
     succeeded=true;
     if(!disconnected) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    } catch {
     // A partial reply is visibly marked incomplete, never reported as complete; reservation remains consumed.
     if(full.trim()) await client.from('chat_messages').insert({user_id:userId,role:'assistant',content:(full.slice(0,7900)+'\n\n[توقف الرد قبل اكتماله]')});
     try{await finish(client,userId,reservationId,'uncertain');}catch{console.error('chat_finalize_failed');}
     emit({error:'توقف الرد قبل اكتماله؛ لن نكرر الطلب تلقائياً.'});
    } finally {
     if(!disconnected) controller.close();
     console.log('chat_outcome',succeeded?'success':'incomplete');
    }
   },cancel(){disconnected=true;},
  });
  id=null;
  return new Response(stream,{headers:{...corsHeaders,'Content-Type':'text/event-stream','Cache-Control':'no-store'}});
 }catch(error){
  if(admin && owner && id) try{await finish(admin,owner,id,outcome);}catch{console.error('chat_finalize_failed');}
  console.error('chat_failed',error instanceof Error?error.name:'unknown');
  return json({error:error instanceof RequestError?error.message:'تعذر إتمام الرد.'},error instanceof RequestError?error.status:500);
 }
});
