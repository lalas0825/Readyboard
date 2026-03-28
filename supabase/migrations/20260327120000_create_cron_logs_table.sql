-- Cron logs table for job observability
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  processed_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_job_created ON cron_logs(job_name, created_at DESC);
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cron_logs' AND policyname = 'Service role manages cron logs'
  ) THEN
    CREATE POLICY "Service role manages cron logs" ON cron_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
