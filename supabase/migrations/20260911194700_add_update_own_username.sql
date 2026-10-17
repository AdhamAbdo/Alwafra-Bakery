/*
# Fix username change breaking login

1. Problem
   - The Settings page lets a manager (and, if ever exposed, an employee)
     change `profiles.username` directly via a plain UPDATE.
   - Login builds the auth email as `${username}@alwafra.internal`, but that
     email lives on `auth.users.email` and was never updated alongside
     `profiles.username`. After a username change, the account becomes
     unable to log back in with the new username (and the old one no
     longer matches `profiles.username` either).

2. Fix
   - Add `update_own_username`, a SECURITY DEFINER RPC that updates
     `profiles.username` and `auth.users.email` together, atomically, for
     the calling user only. Validates the new username isn't blank and
     isn't already taken.
*/

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
