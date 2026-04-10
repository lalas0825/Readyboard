-- Fix: Store role + org_id in JWT app_metadata
-- Eliminates the users table DB query in middleware on every navigation.

-- Step 1: Backfill ALL existing users
UPDATE auth.users au
SET raw_app_meta_data = au.raw_app_meta_data || jsonb_build_object(
  'role', u.role,
  'org_id', u.org_id
)
FROM public.users u
WHERE u.id = au.id;

-- Step 2: Trigger to keep app_metadata in sync
CREATE OR REPLACE FUNCTION public.sync_user_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
      'role', NEW.role,
      'org_id', NEW.org_id
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_role_to_jwt ON public.users;
CREATE TRIGGER trg_sync_user_role_to_jwt
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_jwt();
