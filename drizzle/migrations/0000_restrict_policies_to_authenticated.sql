-- Scope all owner-based policies to the authenticated role only (no anon exposure)

-- favorites
DROP POLICY IF EXISTS "Users can add to their favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can remove from their favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
CREATE POLICY "Users can add to their favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from their favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- style_analyses
DROP POLICY IF EXISTS "Users can create their own analyses" ON public.style_analyses;
DROP POLICY IF EXISTS "Users can delete their own analyses" ON public.style_analyses;
DROP POLICY IF EXISTS "Users can update their own analyses" ON public.style_analyses;
DROP POLICY IF EXISTS "Users can view their own analyses" ON public.style_analyses;
CREATE POLICY "Users can create their own analyses" ON public.style_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own analyses" ON public.style_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own analyses" ON public.style_analyses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own analyses" ON public.style_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ensure grants match policies (no anon access)
REVOKE ALL ON public.favorites, public.profiles, public.style_analyses, public.user_roles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.style_analyses TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.favorites, public.profiles, public.style_analyses, public.user_roles TO service_role;