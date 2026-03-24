-- ============================================================
-- Week 8 — Checklist System: Triggers + RLS + Column Fixes
-- Applied via Supabase MCP as 3 migrations:
--   1. week8_checklist_triggers_and_rls
--   2. widen_weight_columns
--   3. fix_gate_cap_column_name
--   4. set_search_path_on_functions
-- ============================================================

-- ─── 1. Widen weight columns (numeric(3,2) → numeric(5,2)) ──
ALTER TABLE public.area_tasks
  ALTER COLUMN weight TYPE numeric(5,2);

ALTER TABLE public.trade_task_templates
  ALTER COLUMN weight TYPE numeric(5,2);

-- ─── 2. Upgrade calculate_effective_pct with gate cap ────────
CREATE OR REPLACE FUNCTION calculate_effective_pct()
RETURNS TRIGGER AS $$
DECLARE
  total_weight NUMERIC;
  done_weight  NUMERIC;
  gates_ok     BOOLEAN;
  gate_cap     NUMERIC;
BEGIN
  IF NEW.reporting_mode = 'checklist' THEN
    SELECT
      COALESCE(SUM(weight), 0),
      COALESCE(SUM(CASE WHEN status = 'complete' THEN weight ELSE 0 END), 0)
    INTO total_weight, done_weight
    FROM public.area_tasks
    WHERE area_id = NEW.area_id
      AND trade_type = NEW.trade_type
      AND status != 'na';

    NEW.calculated_pct := CASE
      WHEN total_weight > 0 THEN ROUND((done_weight / total_weight) * 100, 1)
      ELSE 0
    END;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.area_tasks
      WHERE area_id = NEW.area_id
        AND trade_type = NEW.trade_type
        AND is_gate = true
        AND status != 'complete'
        AND status != 'na'
    ) INTO gates_ok;

    NEW.all_gates_passed := gates_ok;

    -- GATE CAP: cap effective_pct to max achievable before first incomplete gate
    IF NOT gates_ok AND total_weight > 0 THEN
      SELECT COALESCE(SUM(t.weight), 0)
      INTO gate_cap
      FROM public.area_tasks t
      WHERE t.area_id = NEW.area_id
        AND t.trade_type = NEW.trade_type
        AND t.status != 'na'
        AND t.task_order < (
          SELECT MIN(g.task_order)
          FROM public.area_tasks g
          WHERE g.area_id = NEW.area_id
            AND g.trade_type = NEW.trade_type
            AND g.is_gate = true
            AND g.status != 'complete'
            AND g.status != 'na'
        );

      gate_cap := ROUND((gate_cap / total_weight) * 100, 1);
      NEW.effective_pct := LEAST(NEW.calculated_pct, gate_cap);
    ELSE
      NEW.effective_pct := NEW.calculated_pct;
    END IF;

    -- Auto-set gc_verification_pending: all SUB tasks complete?
    SELECT NOT EXISTS (
      SELECT 1 FROM public.area_tasks
      WHERE area_id = NEW.area_id
        AND trade_type = NEW.trade_type
        AND task_owner = 'sub'
        AND status != 'complete'
        AND status != 'na'
    ) INTO NEW.gc_verification_pending;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── 3. Propagation trigger: area_tasks → area_trade_status ──
CREATE OR REPLACE FUNCTION propagate_task_change()
RETURNS TRIGGER AS $$
DECLARE
  target_area_id UUID;
  target_trade   TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_area_id := OLD.area_id;
    target_trade   := OLD.trade_type;
  ELSE
    target_area_id := NEW.area_id;
    target_trade   := NEW.trade_type;
  END IF;

  UPDATE public.area_trade_status
  SET updated_at = NOW()
  WHERE area_id = target_area_id
    AND trade_type = target_trade
    AND reporting_mode = 'checklist';

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_propagate_task_change ON public.area_tasks;
CREATE TRIGGER trg_propagate_task_change
  AFTER INSERT OR UPDATE OR DELETE ON public.area_tasks
  FOR EACH ROW
  EXECUTE FUNCTION propagate_task_change();


-- ─── 4. Weight validation helper ─────────────────────────────
CREATE OR REPLACE FUNCTION validate_template_weights(
  p_org_id UUID,
  p_trade_type TEXT,
  p_area_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weight), 0) INTO total
  FROM public.trade_task_templates
  WHERE org_id = p_org_id
    AND trade_type = p_trade_type
    AND area_type = p_area_type;

  RETURN total = 100;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- ─── 5. RLS — GC INSERT on area_tasks ────────────────────────
CREATE POLICY "GC inserts area tasks on their projects"
  ON public.area_tasks FOR INSERT
  WITH CHECK (
    is_gc_role()
    AND area_id IN (SELECT get_accessible_area_ids())
  );


-- ─── 6. RLS — GC management on trade_task_templates ──────────
CREATE POLICY "GC manages org templates"
  ON public.trade_task_templates FOR INSERT
  WITH CHECK (
    is_gc_role()
    AND (org_id = get_user_org_id())
  );

CREATE POLICY "GC updates org templates"
  ON public.trade_task_templates FOR UPDATE
  USING (
    is_gc_role()
    AND (org_id = get_user_org_id())
  );

CREATE POLICY "GC deletes org templates"
  ON public.trade_task_templates FOR DELETE
  USING (
    is_gc_role()
    AND (org_id = get_user_org_id())
  );


-- ─── 7. Fix search_path on all existing functions ────────────
ALTER FUNCTION public.close_delay_on_ca_resolved() SET search_path = public;
ALTER FUNCTION public.prevent_delay_log_delete() SET search_path = public;
ALTER FUNCTION public.guard_delay_log_reopen() SET search_path = public;
ALTER FUNCTION public.delay_duration_hours(delay_logs) SET search_path = public;
ALTER FUNCTION public.delay_current_man_hours(delay_logs) SET search_path = public;
ALTER FUNCTION public.delay_computed_daily_cost(delay_logs, numeric) SET search_path = public;
ALTER FUNCTION public.delay_computed_cumulative_cost(delay_logs, numeric) SET search_path = public;
ALTER FUNCTION public.guard_legal_immutability() SET search_path = public;
ALTER FUNCTION public.recalculate_delay_costs() SET search_path = public;
