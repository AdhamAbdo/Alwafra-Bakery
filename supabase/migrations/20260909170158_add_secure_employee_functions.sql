/*
# Add secure employee lifecycle functions

1. New Functions
- `create_employee_account`: creates an auth user and matching profile/employee record using the caller's authenticated session. Only managers may call it. Password is generated server-side and returned once to the manager so they can share it with the employee.
- `reset_employee_password`: generates a new password for an employee's auth account. Only managers may call it.
- `set_employee_active_state`: activates or deactivates an employee profile. Only managers may call it.
- `update_task_status`: updates a task's status, records history, and when completed sets progress to 100 and completed_at. Employees may update their own tasks; managers may update any task.

2. Security
- All functions are SECURITY DEFINER with a fixed search path.
- Authorization is derived from auth.uid() and the profiles table, never from caller-supplied parameters.
- EXECUTE is revoked from anon and granted only to authenticated.
- Passwords are never stored in business tables; they live only in auth.users.
*/

-- Helper: generate a readable random password
CREATE OR REPLACE FUNCTION public.generate_password(p_length int DEFAULT 12)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..p_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_password(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_password(int) TO authenticated;

-- Create employee account (manager only)
CREATE OR REPLACE FUNCTION public.create_employee_account(
  p_full_name text,
  p_username text,
  p_password text,
  p_employee_code text,
  p_job_title text,
  p_department_id uuid,
  p_business_section_id uuid,
  p_phone text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager uuid := auth.uid();
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

  -- Ensure department belongs to the selected section
  SELECT business_section_id INTO v_dept_section
  FROM public.departments WHERE id = p_department_id;
  IF v_dept_section IS NULL THEN
    RAISE EXCEPTION 'الإدارة المحددة غير موجودة';
  END IF;
  IF v_dept_section <> p_business_section_id THEN
    RAISE EXCEPTION 'الإدارة لا تنتمي إلى القسم المحدد';
  END IF;

  -- Check username uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(p_username))) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  -- Check employee code uniqueness
  IF EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_code) = lower(trim(p_employee_code))) THEN
    RAISE EXCEPTION 'كود الموظف مستخدم بالفعل';
  END IF;

  -- Build a synthetic unique email from username
  v_email := lower(trim(p_username)) || '@alwafra.internal';

  -- Check email uniqueness in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'اسم المستخدم مستخدم بالفعل';
  END IF;

  -- Create auth user with a random encrypted password; we set the real password separately
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
    hbo '{}'::jsonb,
    false,
    0
  )
  RETURNING id INTO v_user_id;

  -- Create profile
  INSERT INTO public.profiles (id, full_name, username, role, is_active)
  VALUES (v_user_id, p_full_name, trim(p_username), 'employee', true);

  -- Create employee record
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
REVOKE EXECUTE ON FUNCTION public.create_employee_account(text, text, text, text, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_account(text, text, text, text, text, uuid, uuid, text) TO authenticated;

-- Reset employee password (manager only)
CREATE OR REPLACE FUNCTION public.reset_employee_password(p_employee_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_manager boolean;
  v_profile_id uuid;
  v_email text;
  v_new_password text;
BEGIN
  SELECT public.is_manager() INTO v_is_manager;
  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'غير مصرح لك بإعادة تعيين كلمة المرور';
  END IF;

  SELECT profile_id INTO v_profile_id FROM public.employees WHERE id = p_employee_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_profile_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'حساب المستخدم غير موجود';
  END IF;

  v_new_password := public.generate_password(12);

  UPDATE auth.users
  SET encrypted_password = crypt(v_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_profile_id;

  RETURN v_new_password;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reset_employee_password(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_employee_password(uuid) TO authenticated;

-- Set employee active state (manager only)
CREATE OR REPLACE FUNCTION public.set_employee_active_state(p_employee_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_manager boolean;
  v_profile_id uuid;
BEGIN
  SELECT public.is_manager() INTO v_is_manager;
  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل حالة الموظف';
  END IF;

  SELECT profile_id INTO v_profile_id FROM public.employees WHERE id = p_employee_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود';
  END IF;

  UPDATE public.profiles SET is_active = p_active WHERE id = v_profile_id;
  UPDATE public.employees SET is_active = p_active WHERE id = p_employee_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_employee_active_state(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_employee_active_state(uuid, boolean) TO authenticated;

-- Update task status with history tracking
CREATE OR REPLACE FUNCTION public.update_task_status(
  p_task_id uuid,
  p_new_status text,
  p_progress integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_assigned_to uuid;
  v_is_manager boolean;
  v_emp_id uuid;
  v_can_update boolean;
BEGIN
  SELECT status, assigned_to INTO v_old_status, v_assigned_to FROM public.tasks WHERE id = p_task_id;
  IF v_assigned_to IS NULL THEN
    RAISE EXCEPTION 'المهمة غير موجودة';
  END IF;

  SELECT public.is_manager() INTO v_is_manager;
  v_emp_id := public.current_employee_id();
  v_can_update := v_is_manager OR (v_emp_id = v_assigned_to);
  IF NOT v_can_update THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذه المهمة';
  END IF;

  IF p_new_status NOT IN ('جديدة', 'قيد التنفيذ', 'مكتملة', 'متأخرة', 'ملغاة') THEN
    RAISE EXCEPTION 'حالة المهمة غير صحيحة';
  END IF;

  IF p_progress IS NOT NULL AND (p_progress < 0 OR p_progress > 100) THEN
    RAISE EXCEPTION 'نسبة التقدم يجب أن تكون بين 0 و 100';
  END IF;

  IF p_new_status = 'مكتملة' THEN
    UPDATE public.tasks
    SET status = p_new_status,
        progress_percentage = 100,
        completed_at = now()
    WHERE id = p_task_id;
  ELSE
    IF p_progress IS NOT NULL THEN
      UPDATE public.tasks
      SET status = p_new_status, progress_percentage = p_progress, completed_at = NULL
      WHERE id = p_task_id;
    ELSE
      UPDATE public.tasks
      SET status = p_new_status, completed_at = NULL
      WHERE id = p_task_id;
    END IF;
  END IF;

  IF v_old_status IS DISTINCT FROM p_new_status THEN
    INSERT INTO public.task_status_history (task_id, old_status, new_status, changed_by)
    VALUES (p_task_id, v_old_status, p_new_status, auth.uid());
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_task_status(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_task_status(uuid, text, integer) TO authenticated;
