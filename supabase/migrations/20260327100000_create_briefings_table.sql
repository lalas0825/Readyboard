-- P0-1: Create briefings table
-- AI Morning Briefing storage — referenced by collectBriefingData, generateBriefing, MorningBriefingCard
CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  content TEXT NOT NULL,
  model TEXT DEFAULT 'fallback',
  briefing_date DATE DEFAULT CURRENT_DATE,
  data_snapshot JSONB,
  tokens_used INTEGER,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_project_user ON briefings(project_id, user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_briefings_unique_daily ON briefings(user_id, project_id, briefing_date);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'briefings' AND policyname = 'Users see own briefings'
  ) THEN
    CREATE POLICY "Users see own briefings" ON briefings
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'briefings' AND policyname = 'Users update own briefings'
  ) THEN
    CREATE POLICY "Users update own briefings" ON briefings
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
