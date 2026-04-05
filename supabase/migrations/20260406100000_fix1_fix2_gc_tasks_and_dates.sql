-- Fix 1: GC VERIFY tasks excluded from sub progress percentage
-- Fix 2: Auto track started_at + completed_at on area_trade_status
--
-- Previously: effective_pct counted ALL tasks (sub + gc) in total_weight.
-- Now: effective_pct = sub tasks only. GC gate still blocks DONE status,
--      but does NOT reduce/cap sub progress percentage.
--
-- Gate cap rule updated:
--   - Only caps progress when there's an incomplete SUB gate task
--   - GC gate tasks (task_owner='gc', is_gate=true) block DONE but not %

-- ─── Fix 2: Add date tracking columns ─────────────────────────────────────────
ALTER TABLE area_trade_status
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ─── Fix 1 + Fix 2: Update calculate_effective_pct trigger ────────────────────
CREATE OR REPLACE FUNCTION calculate_effective_pct() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_weight           NUMERIC;
  done_weight            NUMERIC;
  gates_ok               BOOLEAN;
  gate_cap               NUMERIC;
  all_sub_done           BOOLEAN;
  gc_pending             BOOLEAN;
  v_first_sub_gate_order INT;
BEGIN
  IF NEW.reporting_mode = 'checklist' THEN

    -- ── Only count SUB tasks for progress percentage ──────────────────────────
    SELECT
      COALESCE(SUM(weight), 0),
      COALESCE(SUM(CASE WHEN status = 'complete' THEN weight ELSE 0 END), 0)
    INTO total_weight, done_weight
    FROM public.area_tasks
    WHERE area_id = NEW.area_id
      AND trade_type = NEW.trade_type
      AND status != 'na'
      AND task_owner = 'sub';  -- ← ONLY sub tasks count toward %

    NEW.calculated_pct := CASE
      WHEN total_weight > 0 THEN ROUND((done_weight / total_weight) * 100, 1)
      ELSE 0
    END;

    -- ── all_gates_passed: checks ALL gate tasks (both sub and gc) ─────────────
    SELECT NOT EXISTS (
      SELECT 1 FROM public.area_tasks
      WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
        AND is_gate = true AND status NOT IN ('complete', 'na')
    ) INTO gates_ok;
    NEW.all_gates_passed := gates_ok;

    -- ── Gate cap: only applies when there's an incomplete SUB gate ────────────
    -- GC gates block DONE status but do NOT cap sub progress percentage.
    IF NOT gates_ok AND total_weight > 0 THEN
      SELECT MIN(task_order) INTO v_first_sub_gate_order
      FROM public.area_tasks
      WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
        AND is_gate = true AND task_owner = 'sub'
        AND status NOT IN ('complete', 'na');

      IF v_first_sub_gate_order IS NOT NULL THEN
        -- Cap at sub tasks completed before the first incomplete sub gate
        SELECT COALESCE(SUM(t.weight), 0) INTO gate_cap
        FROM public.area_tasks t
        WHERE t.area_id = NEW.area_id AND t.trade_type = NEW.trade_type
          AND t.status != 'na' AND t.task_owner = 'sub'
          AND t.task_order < v_first_sub_gate_order;
        gate_cap := ROUND((gate_cap / total_weight) * 100, 1);
        NEW.effective_pct := LEAST(NEW.calculated_pct, gate_cap);
      ELSE
        -- No incomplete sub gates → sub can reach 100% even if GC gate pending
        NEW.effective_pct := NEW.calculated_pct;
      END IF;
    ELSE
      NEW.effective_pct := NEW.calculated_pct;
    END IF;

    -- ── gc_verification_pending = all SUB done AND at least one GC pending ────
    SELECT NOT EXISTS (
      SELECT 1 FROM public.area_tasks
      WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
        AND task_owner = 'sub' AND status NOT IN ('complete', 'na')
    ) INTO all_sub_done;

    SELECT EXISTS (
      SELECT 1 FROM public.area_tasks
      WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type
        AND task_owner = 'gc' AND status NOT IN ('complete', 'na')
    ) INTO gc_pending;

    NEW.gc_verification_pending := all_sub_done AND gc_pending;

    IF NEW.gc_verification_pending AND (OLD.gc_verification_pending IS DISTINCT FROM true) THEN
      NEW.gc_verification_pending_since := NOW();
    ELSIF NOT NEW.gc_verification_pending THEN
      NEW.gc_verification_pending_since := NULL;
    END IF;

  ELSE
    -- Percentage mode: effective_pct = manual_pct
    NEW.effective_pct := NEW.manual_pct;
    NEW.all_gates_passed := true;
    NEW.gc_verification_pending := false;
    NEW.gc_verification_pending_since := NULL;
  END IF;

  -- ── Fix 2: Auto-track started_at and completed_at ─────────────────────────
  -- started_at: first time effective_pct transitions from 0 → > 0
  IF NEW.effective_pct > 0 AND COALESCE(OLD.effective_pct, 0) = 0 THEN
    NEW.started_at := COALESCE(OLD.started_at, NOW());
  END IF;

  -- completed_at: set when sub progress reaches 100%, cleared if it drops back
  IF NEW.effective_pct >= 100 THEN
    NEW.completed_at := COALESCE(OLD.completed_at, NOW());
  ELSIF NEW.effective_pct < 100 AND COALESCE(OLD.effective_pct, 0) >= 100 THEN
    NEW.completed_at := NULL;  -- Progress went backwards (GC correction)
  END IF;

  RETURN NEW;
END; $$;
