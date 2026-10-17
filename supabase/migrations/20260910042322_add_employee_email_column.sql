/*
# Add email column to employees table

1. Changes
- Adds an `email` column to the `employees` table so the manager can store a real email address for each employee, used for sending welcome and task assignment notifications.

2. Notes
- This column is nullable so existing employee records remain valid.
- The column does NOT affect authentication — auth still uses the synthetic @alwafra.internal email.
*/

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email text;
