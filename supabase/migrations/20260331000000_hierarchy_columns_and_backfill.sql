-- ============================================================
-- Phase 1: Floor → Unit → Area hierarchy
-- Adds area_code, description, sort_order to areas
-- Adds sort_order, updated_at to units
-- Drops restrictive area_type CHECK (allows custom types)
-- Backfills units from existing area naming pattern
-- Generates area_codes
-- ============================================================

-- ─── 1. Add missing columns ─────────────────────────────────

ALTER TABLE areas ADD COLUMN IF NOT EXISTS area_code TEXT;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE units ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── 2. Create indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_areas_unit ON areas(unit_id);
CREATE INDEX IF NOT EXISTS idx_areas_code ON areas(area_code);

-- ─── 3. Drop restrictive CHECK constraints ──────────────────
-- areas.area_type: currently bathroom/kitchen/corridor/office/lobby/utility
-- Need ~25+ types + custom free text
-- units.unit_type: currently apartment/office/retail/common/custom
-- Need standard_2br/studio/luxury_3br/office_suite/common/custom

ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_area_type_check;
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_unit_type_check;

-- ─── 4. Backfill: create units from area naming pattern ─────
-- Pattern: "2A Bathroom" → floor="2", unit_name="2A"
-- All 780 current areas match this pattern

INSERT INTO units (project_id, floor, name, unit_type, sort_order, created_at, updated_at)
SELECT DISTINCT
  a.project_id,
  (regexp_match(a.name, '^(\d+)([A-Z])\s'))[1] AS floor_val,
  (regexp_match(a.name, '^(\d+)([A-Z])\s'))[1] || (regexp_match(a.name, '^(\d+)([A-Z])\s'))[2] AS unit_name,
  'standard_2br' AS unit_type,
  ascii((regexp_match(a.name, '^(\d+)([A-Z])\s'))[2]) - 64 AS sort_order,  -- A=1, B=2, C=3, D=4
  now(),
  now()
FROM areas a
WHERE a.name ~ '^\d+[A-Z]\s'
  AND a.unit_id IS NULL
ON CONFLICT DO NOTHING;

-- ─── 5. Link areas to their units ──────────────────────────

UPDATE areas a
SET unit_id = u.id
FROM units u
WHERE a.project_id = u.project_id
  AND u.name = (regexp_match(a.name, '^(\d+)([A-Z])\s'))[1] || (regexp_match(a.name, '^(\d+)([A-Z])\s'))[2]
  AND a.unit_id IS NULL
  AND a.name ~ '^\d+[A-Z]\s';

-- ─── 6. Generate area_codes ─────────────────────────────────
-- Pattern: {type_prefix}.{floor}{unit_letter}.{seq}
-- bathroom=B, kitchen=K, corridor=C, office=O, lobby=L, utility=U

UPDATE areas a
SET area_code = sub.code,
    sort_order = sub.seq
FROM (
  SELECT
    a2.id,
    CASE
      WHEN a2.area_type ILIKE '%bath%' THEN 'B'
      WHEN a2.area_type ILIKE '%kitchen%' THEN 'K'
      WHEN a2.area_type = 'corridor' THEN 'C'
      WHEN a2.area_type = 'office' THEN 'O'
      WHEN a2.area_type = 'lobby' THEN 'L'
      WHEN a2.area_type = 'utility' THEN 'U'
      ELSE upper(left(a2.area_type, 2))
    END
    || '.' || u.name || '.'
    || ROW_NUMBER() OVER (PARTITION BY a2.unit_id, a2.area_type ORDER BY a2.name)
    AS code,
    ROW_NUMBER() OVER (PARTITION BY a2.unit_id ORDER BY a2.area_type, a2.name)::int AS seq
  FROM areas a2
  JOIN units u ON u.id = a2.unit_id
  WHERE a2.area_code IS NULL
) sub
WHERE a.id = sub.id;
