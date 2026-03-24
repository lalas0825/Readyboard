-- ═══════════════════════════════════════════════════════════════
-- Hardening Sprint — RLS Policy Fixes
-- Applied: 2026-03-23
-- 1. receipt_events: remove overly permissive INSERT
-- 2. audit_log: scope SELECT to same org
-- 3. legal_documents: remove duplicate GC SELECT policy
-- ═══════════════════════════════════════════════════════════════

-- 1. receipt_events INSERT — drop WITH CHECK(true)
--    Service role (used by tracking pixel route) bypasses RLS.
--    No authenticated user should insert receipt events directly.
DROP POLICY IF EXISTS "Service inserts receipt events" ON receipt_events;

-- 2. audit_log SELECT — scope to same org
--    Current policy allows any GC/sub-management to read ALL audit logs.
--    Fix: restrict to entries where changed_by belongs to same org.
DROP POLICY IF EXISTS "Management reads audit log" ON audit_log;

CREATE POLICY "Management reads own org audit log"
  ON audit_log FOR SELECT
  USING (
    (is_gc_role() OR is_sub_management())
    AND changed_by IN (
      SELECT id FROM users WHERE org_id = get_user_org_id()
    )
  );

-- 3. legal_documents — remove duplicate GC SELECT without is_gc_role() check
--    "GC sees published legal docs" (with is_gc_role()) is correct.
--    "GC sees published legal docs only" (without is_gc_role()) is overly permissive.
DROP POLICY IF EXISTS "GC sees published legal docs only" ON legal_documents;
