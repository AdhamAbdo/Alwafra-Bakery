-- Revoke EXECUTE from anon on trigger/helper functions that should not be called directly
REVOKE EXECUTE ON FUNCTION public.create_notification_on_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification_on_note_added() FROM anon, authenticated;
