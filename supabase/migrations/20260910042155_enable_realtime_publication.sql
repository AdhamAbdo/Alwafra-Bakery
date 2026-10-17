/*
# Enable Supabase Realtime for tasks and task_notes

1. Changes
- Adds tables `tasks`, `task_notes`, and `task_status_history` to the Realtime publication so the frontend can subscribe to row-level changes (INSERT, UPDATE, DELETE).

2. Notes
- Realtime must be enabled per table. Without this, `.on('postgres_changes', ...)` subscriptions receive no events.
- This does NOT change RLS — Realtime respects the same policies as normal queries.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_status_history;
