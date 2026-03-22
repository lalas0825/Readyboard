-- Week 6: Manual schedule override columns + audit_log table

-- Add override columns to schedule_items
ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS manual_override_date DATE,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;

-- Audit log for full traceability of overrides and sensitive changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('manual_override', 'status_change', 'scope_change', 'legal_doc_sent')),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);

-- RLS for audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND u.org_id = get_user_org_id()
  )
);

CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
