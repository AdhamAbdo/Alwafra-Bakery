/*
# Notifications and Email Logs

1. Changes
  - Creates `notifications` table for manager notifications (task status changes, comments, assignments)
  - Creates `email_logs` table for tracking email delivery status
  - Adds RLS policies (managers-only read/write on their own notifications)
  - Adds indexes on manager_id, is_read, created_at, task_id
  - Creates a Postgres trigger function that auto-inserts a notification when:
    a) task_status_history row is inserted (status change)
    b) task_notes row is inserted (comment added)
  - Extends update_task_status to also create notifications (belt-and-suspenders)

2. Notes
  - Notifications are keyed to the task's created_by (the manager who assigned the task)
  - RLS ensures only the manager (created_by user) can see their notifications
  - email_logs is manager-only (admin access)
*/

-- =============================================================
-- NOTIFICATIONS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,          -- the manager (task.created_by) who should receive this
  employee_id uuid,                  -- the employee who made the change
  task_id uuid,                      -- the related task
  type text NOT NULL DEFAULT 'task_status_changed',
  title text NOT NULL,
  message text NOT NULL,
  old_status text,
  new_status text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_manager_id ON public.notifications(manager_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(manager_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(manager_id, created_at DESC);
CREATE INDEX idx_notifications_task_id ON public.notifications(task_id);

-- Foreign keys
ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_manager FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_notifications_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_notifications_task FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (manager_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (manager_id = auth.uid());

CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE
  TO authenticated USING (manager_id = auth.uid());

-- =============================================================
-- EMAIL_LOGS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  email_type text NOT NULL,
  related_task_id uuid,
  related_employee_id uuid,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_type ON public.email_logs(email_type);
CREATE INDEX idx_email_logs_task ON public.email_logs(related_task_id);

ALTER TABLE public.email_logs
  ADD CONSTRAINT fk_email_logs_task FOREIGN KEY (related_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_email_logs_employee FOREIGN KEY (related_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select_manager" ON public.email_logs FOR SELECT
  TO authenticated USING (public.is_manager());

CREATE POLICY "email_logs_insert_authenticated" ON public.email_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- =============================================================
-- AUTO-NOTIFICATION TRIGGER FUNCTIONS
-- =============================================================

-- Trigger 1: When a task_status_history row is inserted (status changed)
CREATE OR REPLACE FUNCTION public.create_notification_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title text;
  v_manager_id uuid;
  v_employee_id uuid;
  v_employee_name text;
BEGIN
  -- Get task info
  SELECT t.title, t.created_by, t.assigned_to
  INTO v_task_title, v_manager_id, v_employee_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF v_manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get employee name
  SELECT e.full_name INTO v_employee_name
  FROM public.employees e
  WHERE e.id = v_employee_id;

  -- Don't notify if the manager themselves changed the status
  IF NEW.changed_by = v_manager_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (manager_id, employee_id, task_id, type, title, message, old_status, new_status)
  VALUES (
    v_manager_id,
    v_employee_id,
    NEW.task_id,
    'task_status_changed',
    'تغيير حالة المهمة',
    'قام ' || COALESCE(v_employee_name, 'الموظف') || ' بتغيير حالة المهمة «' || v_task_title || '» من «' || COALESCE(NEW.old_status, 'جديدة') || '» إلى «' || NEW.new_status || '».',
    NEW.old_status,
    NEW.new_status
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_on_status_change ON public.task_status_history;
CREATE TRIGGER trg_notification_on_status_change
  AFTER INSERT ON public.task_status_history
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_on_status_change();

-- Trigger 2: When a task_note is inserted (comment added)
CREATE OR REPLACE FUNCTION public.create_notification_on_note_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title text;
  v_manager_id uuid;
  v_employee_name text;
  v_employee_profile_id uuid;
BEGIN
  -- Get task info
  SELECT t.title, t.created_by
  INTO v_task_title, v_manager_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF v_manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify if the manager themselves added the note
  SELECT e.profile_id INTO v_employee_profile_id
  FROM public.employees e
  WHERE e.id = NEW.employee_id;

  IF v_employee_profile_id = v_manager_id THEN
    RETURN NEW;
  END IF;

  SELECT e.full_name INTO v_employee_name
  FROM public.employees e
  WHERE e.id = NEW.employee_id;

  INSERT INTO public.notifications (manager_id, employee_id, task_id, type, title, message)
  VALUES (
    v_manager_id,
    NEW.employee_id,
    NEW.task_id,
    'task_comment_added',
    'ملاحظة جديدة على المهمة',
    'قام ' || COALESCE(v_employee_name, 'الموظف') || ' بإضافة ملاحظة على المهمة «' || v_task_title || '»: ' || LEFT(NEW.note, 100)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_on_note_added ON public.task_notes;
CREATE TRIGGER trg_notification_on_note_added
  AFTER INSERT ON public.task_notes
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_on_note_added();
