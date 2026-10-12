import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Quota = { rendersLeft: number; chatLeft: number; rendersLimit: number; chatLimit: number };

export const useQuota = () => {
  const [quota, setQuota] = useState<Quota | null>(null);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_quota");
    if (error || !data) return;
    const q = data as { renders_used: number; chat_used: number; renders_limit: number; chat_limit: number };
    setQuota({
      rendersLeft: Math.max(0, q.renders_limit - q.renders_used),
      chatLeft: Math.max(0, q.chat_limit - q.chat_used),
      rendersLimit: q.renders_limit,
      chatLimit: q.chat_limit,
    });
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("quota-changed", refresh);
    return () => window.removeEventListener("quota-changed", refresh);
  }, [refresh]);
  return { quota, refresh };
};

export const notifyQuotaChanged = () => window.dispatchEvent(new Event("quota-changed"));
