-- Fix: get_accessible_area_ids() was only checking org membership.
-- Foremen are assigned directly via user_assignments, not necessarily
-- members of the sub org. Without this fix, every area_tasks UPDATE
-- by a foreman was rejected by "Sub completes sub tasks" RLS policy,
-- causing checklist taps to revert immediately (optimistic → revert).

CREATE OR REPLACE FUNCTION public.get_accessible_area_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Via org membership (GC admin, Sub PM, superintendent with org)
  SELECT a.id FROM areas a
  JOIN projects p ON a.project_id = p.id
  WHERE p.gc_org_id = get_user_org_id()
     OR p.sub_org_id = get_user_org_id()
  UNION
  -- Via direct assignment (foreman assigned to specific areas)
  SELECT area_id FROM user_assignments
  WHERE user_id = auth.uid()
$$;
