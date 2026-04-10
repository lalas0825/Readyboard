-- schedule_baselines: GC-entered planned dates per floor × trade
-- Used by the Manual Entry tab on the Schedule page.
-- Separate from schedule_items (P6 import) — this is manual.

CREATE TABLE IF NOT EXISTS schedule_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  trade_name TEXT NOT NULL,
  floor TEXT NOT NULL,
  planned_start DATE,
  planned_end DATE,
  duration_days INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN planned_start IS NOT NULL AND planned_end IS NOT NULL
        AND planned_end >= planned_start
      THEN (planned_end - planned_start)::INTEGER + 1
      ELSE NULL
    END
  ) STORED,
  activity_id TEXT,
  predecessors TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, trade_name, floor)
);

CREATE INDEX IF NOT EXISTS idx_sched_baselines_project
  ON schedule_baselines(project_id);

ALTER TABLE schedule_baselines ENABLE ROW LEVEL SECURITY;

-- Project members can view baselines
CREATE POLICY "Project members can view schedule_baselines"
  ON schedule_baselines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = schedule_baselines.project_id
        AND user_id = auth.uid()
    )
  );

-- GC roles can insert/update/delete
CREATE POLICY "GC can manage schedule_baselines"
  ON schedule_baselines FOR ALL
  USING (
    is_gc_role()
    AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = schedule_baselines.project_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_gc_role()
    AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = schedule_baselines.project_id
        AND user_id = auth.uid()
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_schedule_baselines_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_schedule_baselines_updated_at
  BEFORE UPDATE ON schedule_baselines
  FOR EACH ROW EXECUTE FUNCTION update_schedule_baselines_updated_at();
