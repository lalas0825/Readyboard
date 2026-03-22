-- Week 5: Performance indexes for schedule + forecast queries
CREATE INDEX IF NOT EXISTS idx_schedule_items_project ON schedule_items(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_area ON schedule_items(area_id) WHERE area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_items_critical ON schedule_items(project_id) WHERE is_critical = true;
CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_project_date ON forecast_snapshots(project_id, snapshot_date);

-- Unique index for idempotent daily snapshot upserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_forecast_snapshot_daily
  ON forecast_snapshots(project_id, COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid), trade_type, snapshot_date);
