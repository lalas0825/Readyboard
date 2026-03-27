-- ============================================================
-- Restore handle_new_user() trigger
-- Dropped during demo user cleanup on 2026-03-27
-- 
-- This trigger auto-creates a public.users profile whenever
-- a new auth.users row is inserted (signup or Admin API).
--
-- Metadata contract:
--   name:     required (string)
--   role:     required (gc_admin | gc_pm | owner | sub_pm | foreman | etc.)
--   org_id:   optional (UUID) — if provided, uses existing org
--   org_name: optional (string) — if provided, creates new org
--   language: optional (string) — defaults to 'en'
-- ============================================================

-- 1. Create or replace the function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_name     TEXT;
  v_role     TEXT;
  v_org_id   UUID;
  v_org_name TEXT;
  v_org_type TEXT;
  v_language TEXT;
BEGIN
  -- Extract metadata from the new auth user
  v_name     := COALESCE(NEW.raw_user_meta_data->>'name', 'Unnamed User');
  v_role     := COALESCE(NEW.raw_user_meta_data->>'role', 'gc_admin');
  v_org_id   := (NEW.raw_user_meta_data->>'org_id')::UUID;
  v_org_name := NEW.raw_user_meta_data->>'org_name';
  v_language := COALESCE(NEW.raw_user_meta_data->>'language', 'en');

  -- Determine org type from role
  IF v_role IN ('gc_admin', 'gc_pm', 'gc_super', 'owner') THEN
    v_org_type := 'gc';
  ELSE
    v_org_type := 'sub';
  END IF;

  -- If no org_id provided, create a new organization
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, type, default_language)
    VALUES (
      COALESCE(v_org_name, v_name || '''s Organization'),
      v_org_type,
      v_language
    )
    RETURNING id INTO v_org_id;
  END IF;

  -- Create the public.users profile
  INSERT INTO users (id, email, name, role, org_id, language, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    v_org_id,
    v_language,
    false  -- always start as not onboarded
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: skip if profile already exists

  RETURN NEW;
END;
$$;

-- 2. Drop existing trigger if any (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
