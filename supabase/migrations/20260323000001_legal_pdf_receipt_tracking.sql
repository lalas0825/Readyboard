-- ═══════════════════════════════════════════════════════════════
-- Week 6 Closure: Legal PDF + Receipt Tracking Infrastructure
-- Applied via Supabase MCP on 2026-03-23
-- ═══════════════════════════════════════════════════════════════

-- 1. Expand audit_log CHECK constraint with new legal actions
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN (
  'manual_override', 'status_change', 'scope_change', 'config_change',
  'import', 'legal_doc_sent', 'legal_doc_published', 'legal_draft_created',
  'change_order_created', 'change_order_approved', 'change_order_rejected',
  'ca_created', 'ca_acknowledged', 'ca_resolved',
  'rea_generated', 'evidence_package_generated', 'receipt_opened'
));

-- 2. Junction table: REA links to multiple delay_logs
CREATE TABLE rea_delay_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  delay_log_id UUID NOT NULL REFERENCES delay_logs(id) ON DELETE CASCADE,
  man_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(legal_document_id, delay_log_id)
);

ALTER TABLE rea_delay_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sub management sees own REA links" ON rea_delay_links
  FOR SELECT USING (
    legal_document_id IN (
      SELECT id FROM legal_documents WHERE org_id = get_user_org_id()
    ) AND is_sub_management()
  );

CREATE POLICY "Sub management creates REA links" ON rea_delay_links
  FOR INSERT WITH CHECK (
    legal_document_id IN (
      SELECT id FROM legal_documents WHERE org_id = get_user_org_id()
    ) AND is_sub_management()
  );

-- 3. Add columns to legal_documents for REA/Evidence support
ALTER TABLE legal_documents
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id),
  ADD COLUMN IF NOT EXISTS trade_name TEXT,
  ADD COLUMN IF NOT EXISTS total_claim_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en' CHECK (locale IN ('en', 'es'));

-- 4. RLS for receipt_events
CREATE POLICY "Service inserts receipt events" ON receipt_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Sub management reads own receipt events" ON receipt_events
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM legal_documents WHERE org_id = get_user_org_id()
    ) AND is_sub_management()
  );

-- 5. GC sees published legal docs (coopetition model)
CREATE POLICY "GC sees published legal docs" ON legal_documents
  FOR SELECT USING (
    published_to_gc = true
    AND is_gc_role()
    AND project_id IN (
      SELECT id FROM projects WHERE gc_org_id = get_user_org_id()
    )
  );

-- 6. Performance indexes
CREATE INDEX IF NOT EXISTS idx_legal_documents_tracking_uuid ON legal_documents(receipt_tracking_uuid);
CREATE INDEX IF NOT EXISTS idx_receipt_events_document_id ON receipt_events(document_id);
CREATE INDEX IF NOT EXISTS idx_rea_delay_links_doc ON rea_delay_links(legal_document_id);
CREATE INDEX IF NOT EXISTS idx_rea_delay_links_delay ON rea_delay_links(delay_log_id);
