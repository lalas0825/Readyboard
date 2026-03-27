-- P1-6: Units table — groups areas within a floor (apartment, office suite, etc.)
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  floor TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT DEFAULT 'apartment'
    CHECK (unit_type IN ('apartment', 'office', 'retail', 'common', 'custom')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_project_floor ON units(project_id, floor);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'units' AND policyname = 'Users see project units'
  ) THEN
    CREATE POLICY "Users see project units" ON units
      FOR ALL USING (
        project_id IN (
          SELECT p.id FROM projects p
          JOIN users u ON u.org_id IN (p.gc_org_id, p.sub_org_id)
          WHERE u.id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add unit_id FK to areas (nullable for backwards compat)
ALTER TABLE areas ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id);
