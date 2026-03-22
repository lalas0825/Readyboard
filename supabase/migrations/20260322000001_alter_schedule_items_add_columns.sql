-- Week 5: Add columns to schedule_items for critical path + baseline tracking
ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baseline_finish DATE,
  ADD COLUMN IF NOT EXISTS actual_finish DATE,
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT false;

-- Lock baseline: copy planned_finish → baseline_finish for any existing rows
UPDATE schedule_items SET baseline_finish = planned_finish WHERE baseline_finish IS NULL;

-- Unique constraint for upsert idempotency (p6_activity_id required for upsert)
ALTER TABLE schedule_items ADD CONSTRAINT uq_schedule_project_activity
  UNIQUE (project_id, p6_activity_id);
