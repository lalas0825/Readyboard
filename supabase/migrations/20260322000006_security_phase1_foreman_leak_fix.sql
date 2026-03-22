-- ============================================================
-- Phase 1: Security Audit Fix — Foreman Leak + RPC Auth + Write Policies
-- Date: 2026-03-22
-- Fixes: S-1 to S-13 from AUDIT_REPORT.md
-- ============================================================

-- ─── Step 1: Create is_sub_management() helper ──────────────
CREATE OR REPLACE FUNCTION is_sub_management()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role IN ('sub_pm', 'superintendent')
     FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

-- ─── Step 2: Fix S-1 — delay_logs SELECT ──────────────
DROP POLICY IF EXISTS "Users see project delay logs" ON delay_logs;

CREATE POLICY "Management sees project delay logs" ON delay_logs
  FOR SELECT USING (
    area_id IN (SELECT get_accessible_area_ids())
    AND (is_gc_role() OR is_sub_management())
  );

CREATE POLICY "Foreman sees own area delay existence" ON delay_logs
  FOR SELECT USING (
    get_user_role() = 'foreman'
    AND area_id IN (
      SELECT ua.area_id FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
    )
  );

-- ─── Step 3: Fix S-2 + S-10 — change_orders SELECT + INSERT ──────
DROP POLICY IF EXISTS "Project members can view change orders" ON change_orders;
DROP POLICY IF EXISTS "Project members can propose change orders" ON change_orders;

CREATE POLICY "Management views change orders" ON change_orders
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id() OR p.sub_org_id = get_user_org_id()
    )
    AND (is_gc_role() OR is_sub_management())
  );

CREATE POLICY "Management proposes change orders" ON change_orders
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id() OR p.sub_org_id = get_user_org_id()
    )
    AND proposed_by = auth.uid()
    AND (is_gc_role() OR is_sub_management())
  );

-- ─── Step 4: Fix S-3 + S-9 — audit_log SELECT + INSERT ──────
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;

CREATE POLICY "Management reads audit log" ON audit_log
  FOR SELECT USING (is_gc_role() OR is_sub_management());

CREATE POLICY "Management writes audit log" ON audit_log
  FOR INSERT WITH CHECK (is_gc_role() OR is_sub_management());

-- ─── Step 5: Fix S-4 — legal_documents SELECT/UPDATE/INSERT ──────
DROP POLICY IF EXISTS "Sub sees own legal docs" ON legal_documents;
DROP POLICY IF EXISTS "Sub updates own legal docs" ON legal_documents;
DROP POLICY IF EXISTS "Sub creates legal docs" ON legal_documents;

CREATE POLICY "Sub management sees own legal docs" ON legal_documents
  FOR SELECT USING (org_id = get_user_org_id() AND is_sub_management());

CREATE POLICY "Sub management updates own legal docs" ON legal_documents
  FOR UPDATE USING (org_id = get_user_org_id() AND is_sub_management());

CREATE POLICY "Sub management creates legal docs" ON legal_documents
  FOR INSERT WITH CHECK (org_id = get_user_org_id() AND is_sub_management());

-- ─── Step 6: Fix S-6 — scope_changes SELECT ──────────────
DROP POLICY IF EXISTS "Users see project scope changes" ON scope_changes;

CREATE POLICY "Management sees project scope changes" ON scope_changes
  FOR SELECT USING (
    area_id IN (SELECT get_accessible_area_ids())
    AND (is_gc_role() OR is_sub_management())
  );

-- ─── Step 7: Fix S-7 — forecast_snapshots SELECT ──────────────
DROP POLICY IF EXISTS "Users see project forecasts" ON forecast_snapshots;

CREATE POLICY "Management sees project forecasts" ON forecast_snapshots
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id() OR p.sub_org_id = get_user_org_id()
    )
    AND (is_gc_role() OR is_sub_management())
  );

-- ─── Step 8: Fix S-8 — production_benchmarks SELECT ──────────────
DROP POLICY IF EXISTS "Users see project benchmarks" ON production_benchmarks;

CREATE POLICY "Management sees project benchmarks" ON production_benchmarks
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id() OR p.sub_org_id = get_user_org_id()
    )
    AND (is_gc_role() OR is_sub_management())
  );

-- ─── Step 9: Fix S-5 — import_schedule_batch() auth ──────────────
DROP FUNCTION IF EXISTS import_schedule_batch(UUID, JSONB);

CREATE FUNCTION import_schedule_batch(p_project_id UUID, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item JSONB;
  resolved_area_id UUID;
  upserted_count INT := 0;
  critical_count INT := 0;
  v_caller_org UUID;
  v_caller_role TEXT;
  v_project_gc_org UUID;
BEGIN
  -- Authorization Gate
  SELECT org_id, role INTO v_caller_org, v_caller_role
  FROM public.users WHERE id = auth.uid();

  IF v_caller_role NOT IN ('gc_admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot import schedule', v_caller_role;
  END IF;

  SELECT gc_org_id INTO v_project_gc_org
  FROM public.projects WHERE id = p_project_id;

  IF v_project_gc_org IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  IF v_caller_org != v_project_gc_org THEN
    RAISE EXCEPTION 'Unauthorized: org does not own this project';
  END IF;

  -- Batch Upsert
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id INTO resolved_area_id
    FROM areas WHERE project_id = p_project_id AND name = item->>'area_name' LIMIT 1;

    INSERT INTO schedule_items (
      project_id, area_name, trade_name, planned_start, planned_finish,
      baseline_finish, p6_activity_id, area_id, is_critical
    ) VALUES (
      p_project_id, item->>'area_name', item->>'trade_name',
      (item->>'planned_start')::DATE, (item->>'planned_finish')::DATE,
      (item->>'baseline_finish')::DATE, item->>'p6_activity_id',
      resolved_area_id, COALESCE((item->>'is_critical')::BOOLEAN, false)
    )
    ON CONFLICT (project_id, p6_activity_id)
    DO UPDATE SET
      planned_start = EXCLUDED.planned_start,
      planned_finish = EXCLUDED.planned_finish,
      baseline_finish = COALESCE(schedule_items.baseline_finish, EXCLUDED.baseline_finish),
      area_id = COALESCE(EXCLUDED.area_id, schedule_items.area_id),
      is_critical = EXCLUDED.is_critical,
      updated_at = NOW();

    upserted_count := upserted_count + 1;
    IF COALESCE((item->>'is_critical')::BOOLEAN, false) THEN
      critical_count := critical_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('upserted', upserted_count, 'critical', critical_count);
END;
$$;

-- ─── Step 10: Fix S-12 — nod_drafts UPDATE ──────────────
CREATE POLICY "Sub management updates nod drafts" ON nod_drafts
  FOR UPDATE USING (
    is_sub_management()
    AND delay_log_id IN (
      SELECT dl.id FROM delay_logs dl
      JOIN areas a ON dl.area_id = a.id
      JOIN projects p ON a.project_id = p.id
      WHERE p.sub_org_id = get_user_org_id()
    )
  );

-- ─── Step 11: Fix S-13 — delay_logs INSERT ──────────────
CREATE POLICY "Foreman creates delay logs on assigned areas" ON delay_logs
  FOR INSERT WITH CHECK (
    area_id IN (
      SELECT ua.area_id FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
    )
  );
