-- Fix storage bucket security: Make analysis-images bucket private
-- and update policies to require authentication

-- 1. Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'analysis-images';

-- 2. Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Analysis images are publicly viewable" ON storage.objects;

-- 3. Create secure SELECT policy - users can only view their own images
CREATE POLICY "Users can view their own analysis images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'analysis-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Add service role policy for edge function access
CREATE POLICY "Service role can access all analysis images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'analysis-images' 
  AND auth.role() = 'service_role'
);