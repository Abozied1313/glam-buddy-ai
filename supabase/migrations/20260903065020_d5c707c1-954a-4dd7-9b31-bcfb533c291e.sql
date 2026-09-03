-- Scope analysis-images policies to authenticated / service_role instead of public (anon included)
DROP POLICY IF EXISTS "Service role can access all analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own analysis images" ON storage.objects;

CREATE POLICY "Service role can access all analysis images"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'analysis-images');

CREATE POLICY "Users can view their own analysis images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'analysis-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own analysis images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'analysis-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own analysis images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'analysis-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own analysis images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'analysis-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Trigger-only SECURITY DEFINER functions must not be callable by API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;