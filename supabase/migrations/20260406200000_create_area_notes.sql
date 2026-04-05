-- Area Notes: per-area communication log
-- Used by Today tab Messages section + web GridDetailPanel
-- Every note is attached to a specific area (not a general chat)

CREATE TABLE area_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE NOT NULL,
  author_id TEXT NOT NULL,           -- UUID or 'system'
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_area_notes_area ON area_notes(area_id, created_at DESC);
CREATE INDEX idx_area_notes_project ON area_notes(project_id, created_at DESC);

ALTER TABLE area_notes ENABLE ROW LEVEL SECURITY;

-- Project members can read all notes in their projects
CREATE POLICY "Project members can view area notes" ON area_notes
  FOR SELECT USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- Project members can create notes (author must be themselves or system)
CREATE POLICY "Project members can create notes" ON area_notes
  FOR INSERT WITH CHECK (
    (author_id = auth.uid()::text OR author_id = 'system') AND
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- Service role can insert system notes
CREATE POLICY "Service role can insert area notes" ON area_notes
  FOR INSERT
  TO service_role
  WITH CHECK (true);
