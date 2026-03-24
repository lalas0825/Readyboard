-- ============================================================
-- Bloque 5: Patch notifications table + add escalation columns
-- Applied via Supabase MCP on 2026-03-24
-- ============================================================

-- ── 1. Add read_at column (code expects timestamptz, not boolean) ──
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ── 2. Add INSERT policy for service role ──
CREATE POLICY "Service inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ── 3. Add indexes for performance ──
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_antispam
  ON notifications(user_id, type, created_at DESC);

-- ── 4. Add last_notification_sent_at to area_trade_status ──
ALTER TABLE area_trade_status
  ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMPTZ;
