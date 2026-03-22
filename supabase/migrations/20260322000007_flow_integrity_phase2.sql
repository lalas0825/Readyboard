-- ============================================================
-- Phase 2: Flow Integrity — Audit Trail + Soft-Delete + Upsert RPC
-- Date: 2026-03-22
-- Fixes: F-1 to F-9 from AUDIT_REPORT.md
-- ============================================================

-- ─── Step 1: F-3 — Expand audit_log.action CHECK constraint ──────
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'manual_override',
    'status_change',
    'scope_change',
    'config_change',
    'import',
    'legal_doc_sent',
    'legal_doc_published',
    'legal_draft_created',
    'change_order_created',
    'change_order_approved',
    'change_order_rejected',
    'ca_created',
    'ca_acknowledged',
    'ca_resolved'
  ));

-- ─── Step 2: F-5 — Soft-delete columns on change_orders ──────
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ─── Step 3: F-4/F-8 — Atomic upsert RPC for forecast snapshots ──────
CREATE OR REPLACE FUNCTION upsert_forecast_snapshots(p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row JSONB;
  v_count INT := 0;
  v_area_id UUID;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_area_id := NULLIF(v_row->>'area_id', '')::UUID;

    INSERT INTO forecast_snapshots (
      project_id, area_id, trade_type, snapshot_date,
      effective_pct, actual_rate, benchmark_rate,
      projected_date, scheduled_date, delta_days
    ) VALUES (
      (v_row->>'project_id')::UUID,
      v_area_id,
      v_row->>'trade_type',
      (v_row->>'snapshot_date')::DATE,
      COALESCE((v_row->>'effective_pct')::NUMERIC, 0),
      (v_row->>'actual_rate')::NUMERIC,
      (v_row->>'benchmark_rate')::NUMERIC,
      (v_row->>'projected_date')::DATE,
      (v_row->>'scheduled_date')::DATE,
      (v_row->>'delta_days')::INT
    )
    ON CONFLICT (
      project_id,
      COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::UUID),
      trade_type,
      snapshot_date
    )
    DO UPDATE SET
      effective_pct = EXCLUDED.effective_pct,
      actual_rate = EXCLUDED.actual_rate,
      benchmark_rate = EXCLUDED.benchmark_rate,
      projected_date = EXCLUDED.projected_date,
      scheduled_date = EXCLUDED.scheduled_date,
      delta_days = EXCLUDED.delta_days,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── Step 4: F-1 — CO → scope_changes integration column ──────
ALTER TABLE scope_changes
  ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES change_orders(id);

CREATE INDEX IF NOT EXISTS idx_scope_changes_co
  ON scope_changes(change_order_id) WHERE change_order_id IS NOT NULL;
