/*
# Add manager bootstrap and profile auto-creation

1. New Functions
- `create_manager_account`: one-time bootstrap function that creates the first manager auth account and profile. It is protected by a shared bootstrap secret supplied through the request and verified against a stored key. After successful creation it can optionally be revoked.
- `handle_new_user`: trigger that auto-creates a minimal profile row for any new auth user that does not already have one, defaulting to employee role. This keeps profiles in sync with auth.users even if the user was created outside the employee function.

2. Security
- `create_manager_account` is SECURITY DEFINER with fixed search_path. The bootstrap secret is passed as a parameter and compared to a value stored in vault. EXECUTE is granted to authenticated and anon for bootstrap only; revoke after use.
- `handle_new_user` runs as a trigger on auth.users. It inserts into public.profiles only when no row exists.
*/

-- Auto-create profile for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Manager bootstrap function
CREATE OR REPLACE FUNCTION public.create_manager_account(
  p_full_name text,
  p_username text,
  p_password text,
  p_bootstrap_secret text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_secret text;
  v_email text;
  v_user_id uuid;
  v_existing_count int;
BEGIN
  -- Verify bootstrap secret from vault
  SELECT decrypted_secret INTO v_stored_secret FROM vault.decrypted_secrets WHERE name = 'MANAGER_BOOTSTRAP_SECRET';
  IF v_stored_secret IS NULL OR v_stored_secret <> p_bootstrap_secret THEN
    RAISE EXCEPTION 'Bootstrap secret غير صحيح';
  END IF;

  -- Prevent creating more than one manager via this function
  SELECT count(*) INTO v_existing_count FROM public.profiles WHERE role = 'manager';
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'يوجد حساب مدير بالفعل';
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'الاسم مطلوب';
  END IF;
  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RAISE EXCEPTION 'اسم المستخدم مطلوب';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  END IF;

  v_email := lower(trim(p_username)) || '@alwafra.internal';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    email_change_confirm_status
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    hbo '{}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'username', trim(p_username), 'role', 'manager'),
    false,
    0
  )
  RETURNING id INTO v_user_id;

  -- Upsert profile as manager
  INSERT INTO public.profiles (id, full_name, username, role, is_active)
  VALUES (v_user_id, p_full_name, trim(p_username), 'manager', true)
  ON CONFLICT (id) DO UPDATE SET role = 'manager', full_name = p_full_name, username = trim(p_username);

  RETURN json_build_object('user_id', v_user_id, 'username', trim(p_username));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_manager_account(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_manager_account(text, text, text, text) TO authenticated, anon;
