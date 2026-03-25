-- invite_tokens: Stores invite links for sub PMs and foremen
CREATE TABLE invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('sub_pm', 'foreman')),
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- project_members: Links sub PMs to projects they've been invited to
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'sub_pm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- RLS
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages invite_tokens"
  ON invite_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "GC reads own invite tokens"
  ON invite_tokens FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Service role manages project_members"
  ON project_members FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users see own project memberships"
  ON project_members FOR SELECT
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX idx_invite_tokens_project ON invite_tokens(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);

-- Expand audit_log CHECK constraint for invite actions
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action IN (
    'field_report_submitted', 'status_changed', 'delay_logged', 'delay_resolved',
    'corrective_action_created', 'corrective_action_acknowledged',
    'corrective_action_in_resolution', 'corrective_action_resolved',
    'nod_generated', 'nod_sent', 'nod_reminder_sent',
    'rea_generated', 'evidence_package_generated', 'receipt_opened',
    'gc_verification_approved', 'gc_correction_requested', 'trade_mode_switched',
    'config_change',
    'invite_created', 'invite_redeemed', 'foreman_invited'
  )
);
