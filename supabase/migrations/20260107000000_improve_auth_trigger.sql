-- Improve handle_new_user function to support Google OAuth metadata and avoid insertion failures
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    fullName TEXT;
BEGIN
    -- Extract full name from Google OAuth metadata or standard metadata
    fullName := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        ''
    );

    -- Insert into profiles table, handling potential conflicts
    INSERT INTO public.profiles (user_id, full_name, avatar_url)
    VALUES (
        NEW.id,
        fullName,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error or handle gracefully
        RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure the trigger is still active (it should be, but good to be explicit)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled but policies allow for system inserts (which SECURITY DEFINER handles)
-- If the user wants to explicitly allow insertions via API for some reason:
-- DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
-- CREATE POLICY "Allow profile insertion on signup"
-- ON public.profiles FOR INSERT
-- WITH CHECK (auth.uid() = user_id);
