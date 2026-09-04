-- 1) Move has_role out of the exposed public schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2) Storage policies: explicit authenticated-owner requirement
DROP POLICY IF EXISTS "Users can view their own analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own analysis images" ON storage.objects;

CREATE POLICY "Users can view their own analysis images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'analysis-images' AND auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own analysis images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'analysis-images' AND auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own analysis images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'analysis-images' AND auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'analysis-images' AND auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own analysis images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'analysis-images' AND auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1]);