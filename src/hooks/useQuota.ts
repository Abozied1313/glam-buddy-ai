import { useCallback,useEffect,useRef,useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
export type Quota={rendersLeft:number;chatLeft:number;rendersLimit:number;chatLimit:number;rendersAvailableAt:string|null;chatAvailableAt:string|null};
export const useQuota=()=>{
 const [quota,setQuota]=useState<Quota|null>(null),[error,setError]=useState(false);const version=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++version.current;
  const {data,error}=await supabase.rpc('get_my_quota');
  if(request!==version.current)return;
  if(error || !data){setQuota(null);setError(true);return;}
  const q=data as unknown as {renders_used:number;chat_used:number;renders_limit:number;chat_limit:number;renders_available_at:string|null;chat_available_at:string|null};
  if(![q.renders_used,q.chat_used,q.renders_limit,q.chat_limit].every(Number.isFinite)){setQuota(null);setError(true);return;}
  setError(false);setQuota({rendersLeft:Math.max(0,q.renders_limit-q.renders_used),chatLeft:Math.max(0,q.chat_limit-q.chat_used),rendersLimit:q.renders_limit,chatLimit:q.chat_limit,rendersAvailableAt:q.renders_available_at,chatAvailableAt:q.chat_available_at});
 },[]);
 useEffect(()=>{void refresh();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setQuota(null);queueMicrotask(()=>void refresh());});window.addEventListener('quota-changed',refresh);const timer=window.setInterval(refresh,30000);return()=>{++version.current;subscription.unsubscribe();window.removeEventListener('quota-changed',refresh);clearInterval(timer);};},[refresh]);
 return {quota,refresh,error};
};
export const notifyQuotaChanged=()=>window.dispatchEvent(new Event('quota-changed'));
