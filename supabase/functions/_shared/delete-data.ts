export function ownedPath(path: string,user: string) {
 return !path.includes('..') && !/[\\?#\x00-\x1f]/.test(path) && (path.startsWith(`${user}/`) || path.startsWith(`generated/${user}/`));
}
export function imagePath(value: unknown,user: string) {
 if(typeof value!=='string') return null;
 try {const path=decodeURIComponent(new URL(value).pathname.split('/analysis-images/')[1] || '');return ownedPath(path,user)?path:null;}catch{return null;}
}
export async function deleteOwnedData(client: any,user: string,scope: string,analysisId: string|null) {
 const {error:lockError}=await client.rpc('set_account_deleting',{p_user:user,p_deleting:true});
 if(lockError) throw new Error('توجد عملية محجوزة أو تعذر تأمين الحذف. حاول بعد انتهائها.');
 try {
  const bucket=client.storage.from('analysis-images'); const paths=new Set<string>();
  if(scope==='analysis') {
   const {data,error}=await client.from('style_analyses').select('image_url,generated_image_url,analysis_result').eq('user_id',user).eq('id',analysisId).single();
   if(error || !data) throw new Error('التحليل غير متاح.');
   for(const url of [data.image_url,data.generated_image_url]) {const path=imagePath(url,user);if(path) paths.add(path);}
   const reference=data.analysis_result?.outfit_preferences?.outfitReferencePath;
   if(reference && ownedPath(reference,user)) paths.add(reference);
   // Shared references are retained; delete them through account/data cleanup instead.
   const {data:other,error:otherError}=await client.from('style_analyses').select('image_url,generated_image_url,analysis_result').eq('user_id',user).neq('id',analysisId);
   if(otherError) throw new Error('تعذر التحقق من علاقات الصور.');
   for(const row of other || []) for(const path of [imagePath(row.image_url,user),imagePath(row.generated_image_url,user),row.analysis_result?.outfit_preferences?.outfitReferencePath]) if(path) paths.delete(path);
  } else if(scope==='data' || scope==='account') {
   const walk=async(prefix:string)=>{
    for(let offset=0;;offset+=100){
     const {data,error}=await bucket.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
     if(error) throw new Error('تعذر قراءة الصور؛ لم يكتمل الحذف.');
     for(const item of data || []) {const path=`${prefix}/${item.name}`;if(!ownedPath(path,user)) throw new Error('مسار غير صالح.');if(item.id) paths.add(path);else await walk(path);}
     if(!data || data.length<100) break;
    }
   };
   await walk(user);await walk(`generated/${user}`);
  }
  const list=Array.from(paths);
  for(let i=0;i<list.length;i+=100){const {error}=await bucket.remove(list.slice(i,i+100));if(error) throw new Error('لم يكتمل حذف الصور؛ يمكنك إعادة المحاولة.');}
  const {error}=await client.rpc('purge_owned_data',{p_user:user,p_scope:scope,p_analysis:analysisId});
  if(error) throw new Error('لم يكتمل حذف البيانات؛ ربما حُذف بعض الصور. يمكنك إعادة المحاولة.');
  if(scope==='account'){const {error}=await client.auth.admin.deleteUser(user);if(error) throw new Error('حُذفت بيانات التطبيق، لكن تعذر حذف الحساب. أعد المحاولة.');}
 }finally{
  const {error}=await client.rpc('set_account_deleting',{p_user:user,p_deleting:false});
  if(error) throw new Error('تعذر إنهاء حالة الحذف؛ لم نؤكد اكتمال العملية.');
 }
}
