/*
# Fix auth metadata for employee creation and new user trigger

1. Problem
   - `create_employee_account` inserts new auth.users with `raw_app_meta_data = '{}'::jsonb`.
   - `handle_new_user` trigger doesn't set `raw_app_meta_data` either.
   - Missing `provider` and `providers` fields causes "Database error querying schema" on login.

2. Fix
   - Drop and recreate `create_employee_account` to set proper `raw_app_meta_data`.
   - Update `handle_new_user` trigger to set `raw_app_meta_data` if missing.
*/

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
SET search_path = public
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
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'username', trim(p_username), 'role', 'employee'),
    false,
    0
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.profiles (id, full_name, username, role, is_active)
  VALUES (v_user_id, p_full_name, trim(p_username), 'employee', true);

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

-- Fix handle_new_user to set raw_app_meta_data if missing
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
  RETURN NEW;
END;
$$;
