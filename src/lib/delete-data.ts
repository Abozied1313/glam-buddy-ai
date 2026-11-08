import { supabase } from '@/integrations/supabase/client';
export async function requestDataDeletion(scope:'analysis'|'chat'|'data'|'account',analysisId?:string){
 const {data,error}=await supabase.functions.invoke('delete-account-data',{body:{scope,analysisId,confirmation:'حذف'}});
 if(error){if(error.context instanceof Response){const details=await error.context.json().catch(()=>null);throw new Error(details?.error || 'لم يكتمل الحذف.');}throw new Error('تعذر الحذف؛ لم نؤكد اكتماله.');}
 if(!data?.success)throw new Error('لم نؤكد اكتمال الحذف.');
}
