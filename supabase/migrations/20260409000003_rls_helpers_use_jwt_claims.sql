-- Fix: RLS helper functions use JWT app_metadata claims
-- instead of querying the users table on every RLS check.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
    (SELECT org_id FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_gc_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  ) IN ('gc_super', 'gc_pm', 'gc_admin', 'owner');
$$;
