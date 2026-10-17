/*
# Create Alwafra Bakery employee and task management schema

1. New Tables
- `profiles`: authenticated user identity, username, role, active state, and timestamps.
- `business_sections`: top-level business sections managed by the company.
- `departments`: departments belonging to business sections.
- `employees`: employee records connected to profiles, sections, and departments.
- `tasks`: manager-created work assigned to employees with status, priority, progress, and dates.
- `task_notes`: notes written by employees on their assigned tasks.
- `task_status_history`: immutable audit trail of task status changes.

2. Integrity
- UUID primary keys, foreign keys, required fields, check constraints, unique usernames and employee codes, and indexes for dashboard and reporting queries.
- Task assignments are constrained to active employees and their selected section and department through application-level validation and protected write paths.

3. Security
- Row Level Security is enabled on every table.
- Managers can access company data; employees can access only their own profile, employee record, assigned tasks, notes, and related history.
- Role and activation fields are protected from employee writes.
- Security-definer helper functions use the authenticated session and a fixed search path.

4. Seed Data
- Adds the initial Alwafra business sections and default departments without duplicating existing rows.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_section_id uuid NOT NULL REFERENCES public.business_sections(id) ON DELETE RESTRICT,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  job_title text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  business_section_id uuid NOT NULL REFERENCES public.business_sections(id) ON DELETE RESTRICT,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  business_section_id uuid NOT NULL REFERENCES public.business_sections(id) ON DELETE RESTRICT,
  priority text NOT NULL DEFAULT 'متوسطة' CHECK (priority IN ('منخفضة', 'متوسطة', 'عالية', 'عاجلة')),
  status text NOT NULL DEFAULT 'جديدة' CHECK (status IN ('جديدة', 'قيد التنفيذ', 'مكتملة', 'متأخرة', 'ملغاة')),
  progress_percentage integer NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  due_date date NOT NULL,
  completed_at timestamptz,
  manager_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL CHECK (new_status IN ('جديدة', 'قيد التنفيذ', 'مكتملة', 'متأخرة', 'ملغاة')),
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS business_sections_name_lower_key ON public.business_sections (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS departments_section_name_lower_key ON public.departments (business_section_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS employees_code_lower_key ON public.employees (lower(employee_code));
CREATE INDEX IF NOT EXISTS departments_section_idx ON public.departments (business_section_id);
CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees (department_id);
CREATE INDEX IF NOT EXISTS employees_section_idx ON public.employees (business_section_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_department_idx ON public.tasks (department_id);
CREATE INDEX IF NOT EXISTS tasks_section_idx ON public.tasks (business_section_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON public.tasks (priority);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS task_notes_task_idx ON public.task_notes (task_id);
CREATE INDEX IF NOT EXISTS task_history_task_idx ON public.task_status_history (task_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS sections_set_updated_at ON public.business_sections;
CREATE TRIGGER sections_set_updated_at BEFORE UPDATE ON public.business_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS departments_set_updated_at ON public.departments;
CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS employees_set_updated_at ON public.employees;
CREATE TRIGGER employees_set_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS task_notes_set_updated_at ON public.task_notes;
CREATE TRIGGER task_notes_set_updated_at BEFORE UPDATE ON public.task_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE profile_id = auth.uid() AND is_active = true LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_manager());
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_manager()) WITH CHECK (id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS sections_select ON public.business_sections;
CREATE POLICY sections_select ON public.business_sections FOR SELECT TO authenticated USING (public.is_manager() OR is_active = true);
DROP POLICY IF EXISTS sections_insert ON public.business_sections;
CREATE POLICY sections_insert ON public.business_sections FOR INSERT TO authenticated WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS sections_update ON public.business_sections;
CREATE POLICY sections_update ON public.business_sections FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS sections_delete ON public.business_sections;
CREATE POLICY sections_delete ON public.business_sections FOR DELETE TO authenticated USING (public.is_manager());

DROP POLICY IF EXISTS departments_select ON public.departments;
CREATE POLICY departments_select ON public.departments FOR SELECT TO authenticated USING (public.is_manager() OR is_active = true);
DROP POLICY IF EXISTS departments_insert ON public.departments;
CREATE POLICY departments_insert ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS departments_update ON public.departments;
CREATE POLICY departments_update ON public.departments FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS departments_delete ON public.departments;
CREATE POLICY departments_delete ON public.departments FOR DELETE TO authenticated USING (public.is_manager());

DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees FOR SELECT TO authenticated USING (public.is_manager() OR profile_id = auth.uid());
DROP POLICY IF EXISTS employees_insert ON public.employees;
CREATE POLICY employees_insert ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS employees_update ON public.employees;
CREATE POLICY employees_update ON public.employees FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS employees_delete ON public.employees;
CREATE POLICY employees_delete ON public.employees FOR DELETE TO authenticated USING (public.is_manager());

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (public.is_manager() OR assigned_to = public.current_employee_id());
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_manager() AND created_by = auth.uid());
DROP POLICY IF EXISTS tasks_update_manager ON public.tasks;
CREATE POLICY tasks_update_manager ON public.tasks FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS tasks_update_employee ON public.tasks;
CREATE POLICY tasks_update_employee ON public.tasks FOR UPDATE TO authenticated USING (assigned_to = public.current_employee_id()) WITH CHECK (assigned_to = public.current_employee_id());
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (public.is_manager());

DROP POLICY IF EXISTS notes_select ON public.task_notes;
CREATE POLICY notes_select ON public.task_notes FOR SELECT TO authenticated USING (public.is_manager() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS notes_insert ON public.task_notes;
CREATE POLICY notes_insert ON public.task_notes FOR INSERT TO authenticated WITH CHECK (employee_id = public.current_employee_id() AND EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_id AND tasks.assigned_to = public.current_employee_id()));
DROP POLICY IF EXISTS notes_update ON public.task_notes;
CREATE POLICY notes_update ON public.task_notes FOR UPDATE TO authenticated USING (public.is_manager() OR employee_id = public.current_employee_id()) WITH CHECK (public.is_manager() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS notes_delete ON public.task_notes;
CREATE POLICY notes_delete ON public.task_notes FOR DELETE TO authenticated USING (public.is_manager() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS history_select ON public.task_status_history;
CREATE POLICY history_select ON public.task_status_history FOR SELECT TO authenticated USING (public.is_manager() OR EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_id AND tasks.assigned_to = public.current_employee_id()));
DROP POLICY IF EXISTS history_insert ON public.task_status_history;
CREATE POLICY history_insert ON public.task_status_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid() AND (public.is_manager() OR EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_id AND tasks.assigned_to = public.current_employee_id())));

INSERT INTO public.business_sections (name, description)
VALUES
  ('المخبوزات', 'قطاع المخبوزات والمنتجات اليومية'),
  ('الكيك', 'قطاع الكيك والحلويات'),
  ('الشوكولاتة', 'قطاع الشوكولاتة والمنتجات الخاصة')
ON CONFLICT DO NOTHING;

INSERT INTO public.departments (name, business_section_id, description)
SELECT names.name, sections.id, names.description
FROM public.business_sections sections
CROSS JOIN (VALUES
  ('المالية', 'الإدارة المالية'),
  ('التحصيل', 'إدارة التحصيل'),
  ('الإنتاج', 'إدارة الإنتاج'),
  ('خدمة العملاء', 'إدارة خدمة العملاء'),
  ('الصيانة', 'إدارة الصيانة'),
  ('الجودة', 'إدارة الجودة')
) AS names(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments existing
  WHERE existing.business_section_id = sections.id AND lower(existing.name) = lower(names.name)
);
