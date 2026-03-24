-- ================================================================
-- Week 8 Bloque 4: GC Verification Queue
-- RLS policies, RPCs, audit constraint expansion
-- Applied via Supabase MCP — this file is git reference only.
-- ================================================================

-- 1A. Expand audit_log CHECK constraint
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN (
  'manual_override', 'status_change', 'scope_change', 'config_change',
  'import', 'legal_doc_sent', 'legal_doc_published', 'legal_draft_created',
  'change_order_created', 'change_order_approved', 'change_order_rejected',
  'ca_created', 'ca_acknowledged', 'ca_resolved',
  'rea_generated', 'evidence_package_generated', 'receipt_opened',
  'gc_verification_approved', 'gc_correction_requested'
));

-- 1B. RLS: GC UPDATE on area_tasks
CREATE POLICY "GC updates area tasks on their projects"
  ON public.area_tasks FOR UPDATE
  USING (
    public.is_gc_role()
    AND area_id IN (SELECT public.get_accessible_area_ids())
  )
  WITH CHECK (
    public.is_gc_role()
    AND area_id IN (SELECT public.get_accessible_area_ids())
  );

-- 1C. RLS: GC UPDATE on area_trade_status
CREATE POLICY "GC updates area trade status on their projects"
  ON public.area_trade_status FOR UPDATE
  USING (
    public.is_gc_role()
    AND area_id IN (SELECT public.get_accessible_area_ids())
  )
  WITH CHECK (
    public.is_gc_role()
    AND area_id IN (SELECT public.get_accessible_area_ids())
  );

-- 1D. RPC: gc_approve_verification
CREATE OR REPLACE FUNCTION public.gc_approve_verification(
  p_area_id UUID,
  p_trade_type TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_task_ids UUID[];
  v_ats_id UUID;
BEGIN
  IF NOT is_gc_role() THEN
    RAISE EXCEPTION 'Unauthorized: only GC roles can approve verifications';
  END IF;

  IF p_area_id NOT IN (SELECT get_accessible_area_ids()) THEN
    RAISE EXCEPTION 'Unauthorized: area not accessible';
  END IF;

  SELECT ARRAY_AGG(id) INTO v_task_ids
  FROM area_tasks
  WHERE area_id = p_area_id
    AND trade_type = p_trade_type
    AND task_owner = 'gc'
    AND status = 'pending';

  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    UPDATE area_tasks
    SET status = 'complete',
        completed_at = NOW(),
        completed_by = p_user_id,
        completed_by_role = 'gc',
        updated_at = NOW()
    WHERE id = ANY(v_task_ids);
  END IF;

  UPDATE area_trade_status
  SET gc_verification_pending = false,
      gc_verification_pending_since = NULL,
      updated_at = NOW()
  WHERE area_id = p_area_id
    AND trade_type = p_trade_type
  RETURNING id INTO v_ats_id;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, new_value, reason)
  VALUES (
    'area_trade_status',
    COALESCE(v_ats_id::TEXT, 'unknown'),
    'gc_verification_approved',
    p_user_id,
    jsonb_build_object(
      'area_id', p_area_id,
      'trade_type', p_trade_type,
      'approved_task_count', COALESCE(array_length(v_task_ids, 1), 0)
    ),
    'GC approved all pending verification tasks'
  );

  RETURN jsonb_build_object(
    'approved_count', COALESCE(array_length(v_task_ids, 1), 0),
    'area_trade_status_id', v_ats_id
  );
END;
$$;

-- 1E. RPC: gc_request_correction
CREATE OR REPLACE FUNCTION public.gc_request_correction(
  p_task_ids UUID[],
  p_area_id UUID,
  p_trade_type TEXT,
  p_user_id UUID,
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ats_id UUID;
  v_count INT;
BEGIN
  IF NOT is_gc_role() THEN
    RAISE EXCEPTION 'Unauthorized: only GC roles can request corrections';
  END IF;

  IF p_area_id NOT IN (SELECT get_accessible_area_ids()) THEN
    RAISE EXCEPTION 'Unauthorized: area not accessible';
  END IF;

  IF p_reason NOT IN ('workmanship', 'wrong_material', 'incomplete', 'failed_test', 'safety', 'other') THEN
    RAISE EXCEPTION 'Invalid correction reason: %', p_reason;
  END IF;

  IF p_reason = 'other' AND (p_note IS NULL OR TRIM(p_note) = '') THEN
    RAISE EXCEPTION 'Note is required when correction reason is other';
  END IF;

  UPDATE area_tasks
  SET status = 'correction_requested',
      correction_reason = p_reason,
      correction_note = p_note,
      correction_requested_at = NOW(),
      correction_requested_by = p_user_id,
      completed_at = NULL,
      completed_by = NULL,
      completed_by_role = NULL,
      updated_at = NOW()
  WHERE id = ANY(p_task_ids)
    AND area_id = p_area_id
    AND trade_type = p_trade_type;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE area_trade_status
  SET gc_verification_pending = false,
      gc_verification_pending_since = NULL,
      updated_at = NOW()
  WHERE area_id = p_area_id
    AND trade_type = p_trade_type
  RETURNING id INTO v_ats_id;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, new_value, reason)
  VALUES (
    'area_trade_status',
    COALESCE(v_ats_id::TEXT, 'unknown'),
    'gc_correction_requested',
    p_user_id,
    jsonb_build_object(
      'area_id', p_area_id,
      'trade_type', p_trade_type,
      'task_ids', to_jsonb(p_task_ids),
      'correction_reason', p_reason,
      'correction_note', p_note,
      'corrected_task_count', v_count
    ),
    'GC requested correction on ' || v_count || ' tasks: ' || p_reason
  );

  RETURN jsonb_build_object(
    'corrected_count', v_count,
    'area_trade_status_id', v_ats_id
  );
END;
$$;
