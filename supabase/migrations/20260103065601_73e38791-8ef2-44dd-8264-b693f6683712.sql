-- Fix remaining storage policies - drop and recreate INSERT policy with correct structure
DROP POLICY IF EXISTS "Users can upload their own analysis images" ON storage.objects;

CREATE POLICY "Users can upload their own analysis images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'analysis-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);