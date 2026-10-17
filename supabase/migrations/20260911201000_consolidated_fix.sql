/*
  RUN THIS ENTIRE FILE AS ONE PASTE IN SUPABASE SQL EDITOR.
  It consolidates every fix so far (NULL auth token columns, missing
  identities, username/email sync, and the gen_salt/search_path +
  duplicate-identity fix for create_employee_account) into one script,
  so nothing can be left half-applied.
*/

-- ============================================================
-- 1. Repair existing broken auth.users rows (NULL token columns)
-- ============================================================
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;

-- ============================================================
-- 2. Backfill missing auth.identities rows
-- ============================================================
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ============================================================
-- 3. Harden handle_new_user trigger (self-heals any new auth.users row)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_app_meta_data IS NULL OR NEW.raw_app_meta_data = '{}'::jsonb OR NOT (NEW.raw_app_meta_data ? 'provider') THEN
    NEW.raw_app_meta_data := jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'));
  END IF;

  INSERT INTO public.profiles (id, full_name, username, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE auth.users SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
  WHERE id = NEW.id;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), NEW.id, NEW.id::text,
    jsonb_build_object('sub', NEW.id::text, 'email', NEW.email),
    'email', now(), now(), now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Username change RPC (keeps auth.users.email in sync)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_own_username(p_new_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_username text := trim(p_new_username);
  v_new_email text;
BEGIN
  IF v_username IS NULL OR length(v_username) = 0 THEN
    RAISE EXCEPTION 'اسم المستخدم مطلوب';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(v_username) AND id <> v_uid
  ) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  v_new_email := lower(v_username) || '@alwafra.internal';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_new_email AND id <> v_uid) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  UPDATE auth.users SET email = v_new_email, updated_at = now() WHERE id = v_uid;
  UPDATE public.profiles SET username = v_username WHERE id = v_uid;

  UPDATE auth.identities
  SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new_email)),
      updated_at = now()
  WHERE user_id = v_uid AND provider = 'email';
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_username(text) TO authenticated;

-- ============================================================
-- 5. create_employee_account: correct search_path + conflict-safe identity insert
-- ============================================================
DROP FUNCTION IF EXISTS public.create_employee_account(text, text, text, text, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.create_employee_account(
  p_full_name text,
  p_username text,
  p_password text,
  p_employee_code text,
  p_job_title text,
  p_department_id uuid,
  p_business_section_id uuid,
  p_phone text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_is_manager boolean;
  v_email text;
  v_user_id uuid;
  v_employee_id uuid;
  v_dept_section uuid;
BEGIN
  SELECT public.is_manager() INTO v_is_manager;
  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء حساب موظف';
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
  IF p_employee_code IS NULL OR length(trim(p_employee_code)) = 0 THEN
    RAISE EXCEPTION 'كود الموظف مطلوب';
  END IF;
  IF p_job_title IS NULL OR length(trim(p_job_title)) = 0 THEN
    RAISE EXCEPTION 'المسمى الوظيفي مطلوب';
  END IF;

  SELECT business_section_id INTO v_dept_section
  FROM public.departments WHERE id = p_department_id;
  IF v_dept_section IS NULL THEN
    RAISE EXCEPTION 'الإدارة المحددة غير موجودة';
  END IF;
  IF v_dept_section <> p_business_section_id THEN
    RAISE EXCEPTION 'الإدارة لا تنتمي إلى القسم المحدد';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(p_username))) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  IF EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(trim(p_employee_code))) THEN
    RAISE EXCEPTION 'كود الموظف مستخدم بالفعل';
  END IF;

  v_email := lower(trim(p_username)) || '@alwafra.internal';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, email_change_confirm_status,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'username', trim(p_username), 'role', 'employee'),
    false, 0,
    '', '', '', '', '', '', '', ''
  )
  RETURNING id INTO v_user_id;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', now(), now(), now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, username, role, is_active)
  VALUES (v_user_id, p_full_name, trim(p_username), 'employee', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.employees (
    profile_id, employee_code, full_name, job_title,
    department_id, business_section_id, phone, is_active
  )
  VALUES (
    v_user_id, trim(p_employee_code), p_full_name, p_job_title,
    p_department_id, p_business_section_id, p_phone, true
  )
  RETURNING id INTO v_employee_id;

  RETURN json_build_object(
    'user_id', v_user_id,
    'employee_id', v_employee_id,
    'username', trim(p_username),
    'email', v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee_account(text, text, text, text, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_account(text, text, text, text, text, uuid, uuid, text) TO authenticated;

-- ============================================================
-- 6. Verify the fix is actually live (check output below after running)
-- ============================================================
select
  case when pg_get_functiondef('public.create_employee_account(text,text,text,text,text,uuid,uuid,text)'::regprocedure)
    ilike '%ON CONFLICT (provider_id, provider) DO NOTHING%'
  then '✅ Fix is live'
  else '❌ Fix NOT applied — something blocked it'
  end as fix_status;
