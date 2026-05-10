import { supabase } from "@/integrations/supabase/client";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

export async function pollReplicateImageGeneration(
  analysisId: string,
  predictionId: string,
  options: { maxAttempts?: number; intervalMs?: number } = {}
) {
  const maxAttempts = options.maxAttempts ?? 180;
  const intervalMs = options.intervalMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase.functions.invoke("analyze-style", {
      body: {
        action: "poll_replicate",
        analysisId,
        predictionId,
      },
    });

    if (error) throw error;

    if (data?.status === "succeeded" && data?.generated_image_url) {
      return data;
    }

    if (TERMINAL_STATUSES.has(data?.status)) {
      throw new Error(data?.error || `Image generation ${data?.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("انتهت مهلة توليد الصورة، يرجى تجربة إعادة التحليل");
}