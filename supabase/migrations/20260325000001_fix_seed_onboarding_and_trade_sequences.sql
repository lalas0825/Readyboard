-- Fix 4: Mark seed users as onboarding_complete
UPDATE users SET onboarding_complete = true
WHERE id IN (
  'd0000000-0000-0000-0000-000000000001',  -- Carlos Foreman
  'd0000000-0000-0000-0000-000000000002'   -- John GC PM
);

-- Fix 5: Expand trade_sequences for seed project to all 4 area types
INSERT INTO trade_sequences (project_id, area_type, trade_name, sequence_order)
SELECT
  'b0000000-0000-0000-0000-000000000001',
  at.area_type,
  ts.trade_name,
  ts.sequence_order
FROM trade_sequences ts
CROSS JOIN (VALUES ('corridor'), ('kitchen'), ('office')) AS at(area_type)
WHERE ts.project_id = 'b0000000-0000-0000-0000-000000000001'
  AND ts.area_type = 'bathroom'
  AND NOT EXISTS (
    SELECT 1 FROM trade_sequences existing
    WHERE existing.project_id = ts.project_id
      AND existing.area_type = at.area_type
      AND existing.trade_name = ts.trade_name
  );
