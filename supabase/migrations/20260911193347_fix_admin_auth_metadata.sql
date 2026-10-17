/*
# Fix admin user auth metadata

1. Problem
   - The admin user's `raw_app_meta_data` was empty `{}`, missing the required `provider` and `providers` fields.
   - Supabase Auth needs these fields to resolve the authentication provider during login.
   - Without them, login fails with "Database error querying schema".

2. Fix
   - Update `raw_app_meta_data` for all auth users that have empty or missing provider metadata.
   - Set `provider: "email"` and `providers: ["email"]` which is correct for email/password auth.
*/

UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object(
  'provider', 'email',
  'providers', jsonb_build_array('email')
)
WHERE raw_app_meta_data IS NULL
   OR raw_app_meta_data = '{}'::jsonb
   OR NOT (raw_app_meta_data ? 'provider');
