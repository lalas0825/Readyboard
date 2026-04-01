-- ============================================================
-- Labor Rates: per-trade, per-role rates + OT rules + crew composition
-- NYC Union Prevailing Wage 2025-2026 defaults
-- ============================================================

-- ─── 1. Create labor_rates table ────────────────────────

CREATE TABLE IF NOT EXISTS labor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  trade_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'journeyperson'
    CHECK (role IN ('foreman', 'journeyperson', 'apprentice', 'helper', 'finisher', 'tender')),
  hourly_rate NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, trade_name, role)
);

CREATE INDEX IF NOT EXISTS idx_labor_rates_project ON labor_rates(project_id);
CREATE INDEX IF NOT EXISTS idx_labor_rates_trade ON labor_rates(project_id, trade_name);
ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;

-- RLS: same pattern as units — users in org that owns the project
CREATE POLICY "Users can view labor rates" ON labor_rates
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN users u ON (u.org_id = p.gc_org_id OR u.org_id = p.sub_org_id)
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "GC admins can manage labor rates" ON labor_rates
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN users u ON (u.org_id = p.gc_org_id)
      WHERE u.id = auth.uid()
      AND u.role IN ('gc_admin', 'gc_pm')
    )
  );

-- ─── 2. ALTER trade_sequences — OT rules + crew ────────

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS
  straight_time_hours NUMERIC(4,1) DEFAULT 8.0;

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS
  ot_multiplier NUMERIC(4,2) DEFAULT 1.5;

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS
  dt_multiplier NUMERIC(4,2) DEFAULT 2.0;

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS
  saturday_rule TEXT DEFAULT 'ot';

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS
  typical_crew JSONB DEFAULT '{"foreman": 1, "journeyperson": 3, "apprentice": 1, "helper": 0}';

-- ─── 3. Seed function — called after trade_sequences ────

CREATE OR REPLACE FUNCTION seed_labor_rates(p_project_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_trade RECORD;
  v_defaults JSONB;
  v_role TEXT;
  v_rate NUMERIC;
  v_roles TEXT[] := ARRAY['foreman', 'journeyperson', 'apprentice', 'helper'];
BEGIN
  -- NYC Union Prevailing Wage defaults 2025-2026
  v_defaults := '{
    "Rough Plumbing":       {"foreman":140,"journeyperson":127,"apprentice":76,"helper":55,"st":8,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":2,"apprentice":1,"helper":0}},
    "Metal Stud Framing":   {"foreman":119,"journeyperson":108,"apprentice":65,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"straight_makeup","crew":{"foreman":1,"journeyperson":3,"apprentice":1,"helper":1}},
    "MEP Rough-In":         {"foreman":135,"journeyperson":123,"apprentice":74,"helper":53,"st":7,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":3,"apprentice":1,"helper":0}},
    "Fire Stopping":        {"foreman":111,"journeyperson":101,"apprentice":61,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":2,"apprentice":0,"helper":1}},
    "Insulation & Drywall": {"foreman":119,"journeyperson":108,"apprentice":65,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"straight_makeup","crew":{"foreman":1,"journeyperson":3,"apprentice":1,"helper":1}},
    "Waterproofing":        {"foreman":107,"journeyperson":98,"apprentice":59,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":2,"apprentice":0,"helper":1}},
    "Tile / Stone":         {"foreman":117,"journeyperson":107,"apprentice":64,"helper":86,"st":7,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":3,"apprentice":1,"helper":1}},
    "Paint":                {"foreman":105,"journeyperson":95,"apprentice":57,"helper":45,"st":7,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":3,"apprentice":1,"helper":0}},
    "Ceiling Grid / ACT":   {"foreman":119,"journeyperson":108,"apprentice":65,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"straight_makeup","crew":{"foreman":1,"journeyperson":2,"apprentice":1,"helper":0}},
    "MEP Trim-Out":         {"foreman":135,"journeyperson":123,"apprentice":74,"helper":53,"st":7,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":2,"apprentice":1,"helper":0}},
    "Doors & Hardware":     {"foreman":119,"journeyperson":108,"apprentice":65,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"straight_makeup","crew":{"foreman":1,"journeyperson":2,"apprentice":0,"helper":1}},
    "Millwork & Countertops":{"foreman":122,"journeyperson":111,"apprentice":67,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"straight_makeup","crew":{"foreman":1,"journeyperson":2,"apprentice":1,"helper":0}},
    "Flooring":             {"foreman":99,"journeyperson":90,"apprentice":54,"helper":42,"st":8,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":2,"apprentice":1,"helper":0}},
    "Final Clean & Punch":  {"foreman":111,"journeyperson":101,"apprentice":61,"helper":48,"st":8,"ot":1.5,"dt":2.0,"sat":"ot","crew":{"foreman":1,"journeyperson":2,"apprentice":0,"helper":2}}
  }'::jsonb;

  -- For each distinct trade in this project's trade_sequences
  FOR v_trade IN
    SELECT DISTINCT trade_name
    FROM trade_sequences
    WHERE project_id = p_project_id
  LOOP
    -- Skip if no defaults for this trade
    IF NOT v_defaults ? v_trade.trade_name THEN
      CONTINUE;
    END IF;

    -- Update OT rules + crew on trade_sequences
    UPDATE trade_sequences SET
      straight_time_hours = (v_defaults->v_trade.trade_name->>'st')::numeric,
      ot_multiplier = (v_defaults->v_trade.trade_name->>'ot')::numeric,
      dt_multiplier = (v_defaults->v_trade.trade_name->>'dt')::numeric,
      saturday_rule = v_defaults->v_trade.trade_name->>'sat',
      typical_crew = v_defaults->v_trade.trade_name->'crew'
    WHERE project_id = p_project_id AND trade_name = v_trade.trade_name;

    -- Insert labor rates for each role (upsert)
    FOREACH v_role IN ARRAY v_roles
    LOOP
      v_rate := (v_defaults->v_trade.trade_name->>v_role)::numeric;
      IF v_rate IS NOT NULL AND v_rate > 0 THEN
        INSERT INTO labor_rates (project_id, trade_name, role, hourly_rate)
        VALUES (p_project_id, v_trade.trade_name, v_role, v_rate)
        ON CONFLICT (project_id, trade_name, role)
        DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate, updated_at = now();
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$function$;
