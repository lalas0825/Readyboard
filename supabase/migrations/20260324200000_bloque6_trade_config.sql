-- ============================================================
-- Bloque 6: Trade Configuration (Mode Toggle)
-- Applied via Supabase MCP on 2026-03-24
-- ============================================================

-- ── 1. Project Trade Configs table ──────────────────────────
CREATE TABLE IF NOT EXISTS project_trade_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL,
  reporting_mode TEXT NOT NULL DEFAULT 'percentage'
    CHECK (reporting_mode IN ('percentage', 'checklist')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(project_id, trade_type)
);

ALTER TABLE project_trade_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GC reads project trade configs"
  ON project_trade_configs FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN users u ON u.org_id = p.gc_org_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "GC updates project trade configs"
  ON project_trade_configs FOR UPDATE
  USING (public.is_gc_role())
  WITH CHECK (public.is_gc_role());

CREATE POLICY "GC inserts project trade configs"
  ON project_trade_configs FOR INSERT
  WITH CHECK (public.is_gc_role());

CREATE POLICY "Service manages project trade configs"
  ON project_trade_configs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ptc_project ON project_trade_configs(project_id);

-- ── 2. RPC: switch_trade_mode ───────────────────────────────
CREATE OR REPLACE FUNCTION public.switch_trade_mode(
  p_project_id UUID,
  p_trade_type TEXT,
  p_new_mode TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_active_count INTEGER;
  v_area_count INTEGER;
  v_config_id UUID;
BEGIN
  IF p_new_mode NOT IN ('percentage', 'checklist') THEN
    RAISE EXCEPTION 'Invalid mode: %%. Must be percentage or checklist', p_new_mode;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
    AND role IN ('gc_super', 'gc_pm', 'gc_admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Only GC roles can change trade mode';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM area_tasks at_
  JOIN areas a ON at_.area_id = a.id
  WHERE a.project_id = p_project_id
    AND at_.trade_type = p_trade_type
    AND at_.status IN ('pending', 'correction_requested');

  IF v_active_count > 0 AND p_new_mode = 'percentage' THEN
    RAISE EXCEPTION 'Cannot switch to percentage mode: %% active task(s) exist.', v_active_count;
  END IF;

  INSERT INTO project_trade_configs (project_id, trade_type, reporting_mode, updated_at, updated_by)
  VALUES (p_project_id, p_trade_type, p_new_mode, NOW(), p_user_id)
  ON CONFLICT (project_id, trade_type)
  DO UPDATE SET
    reporting_mode = p_new_mode,
    updated_at = NOW(),
    updated_by = p_user_id
  RETURNING id INTO v_config_id;

  UPDATE area_trade_status ats
  SET reporting_mode = p_new_mode,
      updated_at = NOW()
  FROM areas a
  WHERE ats.area_id = a.id
    AND a.project_id = p_project_id
    AND ats.trade_type = p_trade_type;

  GET DIAGNOSTICS v_area_count = ROW_COUNT;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, new_value)
  VALUES (
    'project_trade_configs',
    v_config_id::TEXT,
    'config_change',
    p_user_id,
    jsonb_build_object(
      'project_id', p_project_id,
      'trade_type', p_trade_type,
      'new_mode', p_new_mode,
      'areas_updated', v_area_count
    )
  );

  RETURN jsonb_build_object(
    'config_id', v_config_id,
    'areas_updated', v_area_count,
    'new_mode', p_new_mode
  );
END;
$$;
