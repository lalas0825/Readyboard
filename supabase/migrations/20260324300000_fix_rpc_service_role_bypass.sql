-- Bloque 7 fixes discovered via Playwright E2E testing:
-- 1. Service role bypass: RPCs use is_gc_role() → auth.uid() which is NULL with service key
-- 2. audit_log record_id is UUID, not TEXT — removed ::TEXT cast
-- 3. gc_verification_pending logic: must check BOTH "all SUB done" AND "GC tasks pending"
--
-- Applied via Supabase MCP (3 migrations consolidated).

-- ─── Fix 1+2: gc_approve_verification ─────────────────────────
CREATE OR REPLACE FUNCTION gc_approve_verification(
  p_area_id UUID, p_trade_type TEXT, p_user_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_task_ids UUID[]; v_ats_id UUID;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' AND NOT is_gc_role() THEN
    RAISE EXCEPTION 'Unauthorized: only GC roles can approve verifications';
  END IF;
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_area_id NOT IN (SELECT get_accessible_area_ids()) THEN
    RAISE EXCEPTION 'Unauthorized: area not accessible';
  END IF;

  SELECT ARRAY_AGG(id) INTO v_task_ids FROM area_tasks
  WHERE area_id = p_area_id AND trade_type = p_trade_type AND task_owner = 'gc' AND status = 'pending';

  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    UPDATE area_tasks SET status = 'complete', completed_at = NOW(), completed_by = p_user_id,
      completed_by_role = 'gc', updated_at = NOW() WHERE id = ANY(v_task_ids);
  END IF;

  UPDATE area_trade_status SET gc_verification_pending = false, gc_verification_pending_since = NULL,
    updated_at = NOW() WHERE area_id = p_area_id AND trade_type = p_trade_type RETURNING id INTO v_ats_id;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, new_value, reason) VALUES (
    'area_trade_status', v_ats_id, 'gc_verification_approved', p_user_id,
    jsonb_build_object('area_id', p_area_id, 'trade_type', p_trade_type,
      'approved_task_count', COALESCE(array_length(v_task_ids, 1), 0)),
    'GC approved all pending verification tasks');

  RETURN jsonb_build_object('approved_count', COALESCE(array_length(v_task_ids, 1), 0), 'area_trade_status_id', v_ats_id);
END; $$;

-- ─── Fix 1+2: gc_request_correction ───────────────────────────
CREATE OR REPLACE FUNCTION gc_request_correction(
  p_task_ids UUID[], p_area_id UUID, p_trade_type TEXT, p_user_id UUID, p_reason TEXT, p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_ats_id UUID; v_count INT;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' AND NOT is_gc_role() THEN
    RAISE EXCEPTION 'Unauthorized: only GC roles can request corrections';
  END IF;
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_area_id NOT IN (SELECT get_accessible_area_ids()) THEN
    RAISE EXCEPTION 'Unauthorized: area not accessible';
  END IF;
  IF p_reason NOT IN ('workmanship', 'wrong_material', 'incomplete', 'failed_test', 'safety', 'other') THEN
    RAISE EXCEPTION 'Invalid correction reason: %', p_reason;
  END IF;
  IF p_reason = 'other' AND (p_note IS NULL OR TRIM(p_note) = '') THEN
    RAISE EXCEPTION 'Note is required when correction reason is other';
  END IF;

  UPDATE area_tasks SET status = 'correction_requested', correction_reason = p_reason, correction_note = p_note,
    correction_requested_at = NOW(), correction_requested_by = p_user_id, completed_at = NULL, completed_by = NULL,
    completed_by_role = NULL, updated_at = NOW()
  WHERE id = ANY(p_task_ids) AND area_id = p_area_id AND trade_type = p_trade_type;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE area_trade_status SET gc_verification_pending = false, gc_verification_pending_since = NULL,
    updated_at = NOW() WHERE area_id = p_area_id AND trade_type = p_trade_type RETURNING id INTO v_ats_id;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, new_value, reason) VALUES (
    'area_trade_status', v_ats_id, 'gc_correction_requested', p_user_id,
    jsonb_build_object('area_id', p_area_id, 'trade_type', p_trade_type, 'task_ids', to_jsonb(p_task_ids),
      'correction_reason', p_reason, 'correction_note', p_note, 'corrected_task_count', v_count),
    'GC requested correction on ' || v_count || ' tasks: ' || p_reason);

  RETURN jsonb_build_object('corrected_count', v_count, 'area_trade_status_id', v_ats_id);
END; $$;

-- ─── Fix 3: calculate_effective_pct trigger ───────────────────
-- gc_verification_pending = all_sub_done AND gc_has_pending_tasks
CREATE OR REPLACE FUNCTION calculate_effective_pct() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_weight NUMERIC; done_weight NUMERIC; gates_ok BOOLEAN; gate_cap NUMERIC;
  all_sub_done BOOLEAN; gc_pending BOOLEAN;
BEGIN
  IF NEW.reporting_mode = 'checklist' THEN
    SELECT COALESCE(SUM(weight), 0), COALESCE(SUM(CASE WHEN status = 'complete' THEN weight ELSE 0 END), 0)
    INTO total_weight, done_weight FROM public.area_tasks
    WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type AND status != 'na';

    NEW.calculated_pct := CASE WHEN total_weight > 0 THEN ROUND((done_weight / total_weight) * 100, 1) ELSE 0 END;

    SELECT NOT EXISTS (SELECT 1 FROM public.area_tasks WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
      AND is_gate = true AND status NOT IN ('complete', 'na')) INTO gates_ok;
    NEW.all_gates_passed := gates_ok;

    IF NOT gates_ok AND total_weight > 0 THEN
      SELECT COALESCE(SUM(t.weight), 0) INTO gate_cap FROM public.area_tasks t
      WHERE t.area_id = NEW.area_id AND t.trade_type = NEW.trade_type AND t.status != 'na'
        AND t.task_order < (SELECT MIN(g.task_order) FROM public.area_tasks g
          WHERE g.area_id = NEW.area_id AND g.trade_type = NEW.trade_type AND g.is_gate = true
          AND g.status NOT IN ('complete', 'na'));
      gate_cap := ROUND((gate_cap / total_weight) * 100, 1);
      NEW.effective_pct := LEAST(NEW.calculated_pct, gate_cap);
    ELSE
      NEW.effective_pct := NEW.calculated_pct;
    END IF;

    -- gc_verification_pending = all SUB done AND at least one GC task still pending
    SELECT NOT EXISTS (SELECT 1 FROM public.area_tasks WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
      AND task_owner = 'sub' AND status NOT IN ('complete', 'na')) INTO all_sub_done;
    SELECT EXISTS (SELECT 1 FROM public.area_tasks WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
      AND task_owner = 'gc' AND status NOT IN ('complete', 'na')) INTO gc_pending;
    NEW.gc_verification_pending := all_sub_done AND gc_pending;

    IF NEW.gc_verification_pending AND (OLD.gc_verification_pending IS DISTINCT FROM true) THEN
      NEW.gc_verification_pending_since := NOW();
    ELSIF NOT NEW.gc_verification_pending THEN
      NEW.gc_verification_pending_since := NULL;
    END IF;

  ELSE
    NEW.effective_pct := NEW.manual_pct;
    NEW.all_gates_passed := true;
    NEW.gc_verification_pending := false;
    NEW.gc_verification_pending_since := NULL;
  END IF;

  RETURN NEW;
END; $$;
