-- feedback_reports: user-submitted bug reports, feature requests, and general feedback
-- Writen from both web (GC dashboard) and mobile (foreman Expo app)

CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL,
  reporter_name TEXT,
  reporter_role TEXT,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'feedback', 'question')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  page_url TEXT,
  app_source TEXT DEFAULT 'web' CHECK (app_source IN ('web', 'mobile')),
  device_info TEXT,
  screenshots JSONB DEFAULT '[]',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),
  admin_notes TEXT,
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_project ON feedback_reports(project_id, created_at DESC);
CREATE INDEX idx_feedback_status ON feedback_reports(status) WHERE status IN ('new', 'reviewing', 'in_progress');
CREATE INDEX idx_feedback_reporter ON feedback_reports(reported_by, created_at DESC);

ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit a report
CREATE POLICY "feedback_insert_own"
  ON feedback_reports
  FOR INSERT
  WITH CHECK (reported_by = auth.uid());

-- Users can read their own reports (to see status + admin response)
CREATE POLICY "feedback_select_own"
  ON feedback_reports
  FOR SELECT
  USING (reported_by = auth.uid());

-- GC Admin can read all reports
CREATE POLICY "feedback_admin_select"
  ON feedback_reports
  FOR SELECT
  USING (get_user_role() = 'gc_admin');

-- GC Admin can update status + admin_notes + admin_response
CREATE POLICY "feedback_admin_update"
  ON feedback_reports
  FOR UPDATE
  USING (get_user_role() = 'gc_admin');

-- GC Admin can delete reports
CREATE POLICY "feedback_admin_delete"
  ON feedback_reports
  FOR DELETE
  USING (get_user_role() = 'gc_admin');

-- Storage bucket for feedback screenshots (create manually in Supabase dashboard)
-- Bucket name: feedback-screenshots
-- Public: false, max file size: 5MB, allowed MIME: image/*
