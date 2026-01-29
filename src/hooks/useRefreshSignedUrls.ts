import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to refresh signed URLs for private storage bucket images
 * The analysis-images bucket is private, so URLs expire after a period
 * This hook refreshes them when the component mounts
 */
export const useRefreshSignedUrls = (
  originalImageUrl: string | null,
  generatedImageUrl: string | null
) => {
  const [refreshedImageUrl, setRefreshedImageUrl] = useState<string | null>(null);
  const [refreshedGeneratedUrl, setRefreshedGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refreshUrls = async () => {
      if (!originalImageUrl) {
        setLoading(false);
        return;
      }

      try {
        // Extract file path from the signed URL
        const originalPath = extractPathFromUrl(originalImageUrl);
        const generatedPath = generatedImageUrl ? extractPathFromUrl(generatedImageUrl) : null;

        // Refresh the original image URL
        if (originalPath) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("analysis-images")
            .createSignedUrl(originalPath, 60 * 60); // 1 hour

          if (!signedError && signedData) {
            setRefreshedImageUrl(signedData.signedUrl);
          } else {
            console.error("Error refreshing original image URL:", signedError);
            // Fallback to original URL
            setRefreshedImageUrl(originalImageUrl);
          }
        } else {
          setRefreshedImageUrl(originalImageUrl);
        }

        // Refresh the generated image URL if it exists
        if (generatedPath) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("analysis-images")
            .createSignedUrl(generatedPath, 60 * 60); // 1 hour

          if (!signedError && signedData) {
            setRefreshedGeneratedUrl(signedData.signedUrl);
          } else {
            console.error("Error refreshing generated image URL:", signedError);
            // Fallback to original URL
            setRefreshedGeneratedUrl(generatedImageUrl);
          }
        } else {
          setRefreshedGeneratedUrl(generatedImageUrl);
        }
      } catch (err: any) {
        console.error("Error refreshing URLs:", err);
        setError(err.message);
        // Fallback to original URLs
        setRefreshedImageUrl(originalImageUrl);
        setRefreshedGeneratedUrl(generatedImageUrl);
      } finally {
        setLoading(false);
      }
    };

    refreshUrls();
  }, [originalImageUrl, generatedImageUrl]);

  return {
    refreshedImageUrl,
    refreshedGeneratedUrl,
    loading,
    error,
  };
};

/**
 * Extract the file path from a Supabase storage URL
 * Handles both public URLs and signed URLs
 */
function extractPathFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;

    // For signed URLs: /storage/v1/object/sign/bucket-name/path
    const signMatch = pathname.match(/\/storage\/v1\/object\/sign\/analysis-images\/(.+)/);
    if (signMatch) {
      return signMatch[1];
    }

    // For public URLs: /storage/v1/object/public/bucket-name/path
    const publicMatch = pathname.match(/\/storage\/v1\/object\/public\/analysis-images\/(.+)/);
    if (publicMatch) {
      return publicMatch[1];
    }

    // For authenticated URLs: /storage/v1/object/authenticated/bucket-name/path
    const authMatch = pathname.match(/\/storage\/v1\/object\/authenticated\/analysis-images\/(.+)/);
    if (authMatch) {
      return authMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export default useRefreshSignedUrls;
