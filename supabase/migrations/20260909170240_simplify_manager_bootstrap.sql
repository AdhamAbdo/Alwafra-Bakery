/*
# Simplify manager bootstrap: direct SQL approach

1. Changes
- Drop the vault-dependent `create_manager_account` function. The first manager account will be created directly in auth.users and profiles via a SQL migration, which runs with elevated privileges.
- This is a one-time setup step; subsequent employees are created through the secure `create_employee_account` RPC called by the manager from the frontend.

2. Security
- No vault dependency remains.
- The `handle_new_user` trigger still ensures profiles exist for all auth users.
- `create_employee_account` remains the protected path for employee creation.
*/

DROP FUNCTION IF EXISTS public.create_manager_account(text, text, text, text);
