-- ============================================================
-- Update complete_onboarding to create units + set area_code
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id uuid,
  p_org_name text,
  p_org_language text DEFAULT 'en',
  p_project_name text DEFAULT NULL,
  p_project_address text DEFAULT NULL,
  p_labor_rate numeric DEFAULT 85.00,
  p_jurisdiction text DEFAULT 'NY',
  p_trades jsonb DEFAULT NULL,
  p_areas jsonb DEFAULT NULL,
  p_invites jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_org_id uuid;
  v_project_id uuid;
  v_area record;
  v_area_id uuid;
  v_unit_id uuid;
  v_trade record;
  v_areas_created integer := 0;
  v_tasks_cloned integer := 0;
  v_cloned integer;
  v_ts record;
  v_unit_name text;
  v_match text[];
BEGIN
  SELECT id, org_id, role INTO v_user FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  v_org_id := v_user.org_id;

  -- Update org name/language
  UPDATE organizations SET name = p_org_name, default_language = p_org_language, updated_at = now()
  WHERE id = v_org_id;

  -- Project: create or update
  IF p_project_name IS NOT NULL THEN
    SELECT id INTO v_project_id
    FROM projects WHERE gc_org_id = v_org_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_project_id IS NOT NULL THEN
      UPDATE projects SET
        name = p_project_name,
        address = COALESCE(p_project_address, address),
        labor_rate_per_hour = p_labor_rate,
        legal_jurisdiction = p_jurisdiction,
        updated_at = now()
      WHERE id = v_project_id;
    ELSE
      INSERT INTO projects (name, address, labor_rate_per_hour, legal_jurisdiction, gc_org_id)
      VALUES (p_project_name, p_project_address, p_labor_rate, p_jurisdiction, v_org_id)
      RETURNING id INTO v_project_id;
    END IF;
  ELSE
    SELECT id INTO v_project_id
    FROM projects WHERE gc_org_id = v_org_id
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Trades
  IF p_trades IS NOT NULL AND jsonb_typeof(p_trades) = 'array' AND v_project_id IS NOT NULL THEN
    DELETE FROM trade_sequences WHERE project_id = v_project_id;
    FOR v_trade IN SELECT * FROM jsonb_to_recordset(p_trades) AS x(trade_name text, sequence_order int)
    LOOP
      INSERT INTO trade_sequences (project_id, area_type, trade_name, sequence_order)
      VALUES
        (v_project_id, 'bathroom', v_trade.trade_name, v_trade.sequence_order),
        (v_project_id, 'kitchen', v_trade.trade_name, v_trade.sequence_order),
        (v_project_id, 'corridor', v_trade.trade_name, v_trade.sequence_order),
        (v_project_id, 'office', v_trade.trade_name, v_trade.sequence_order);
    END LOOP;
  END IF;

  -- Areas (now with unit creation)
  IF p_areas IS NOT NULL AND jsonb_typeof(p_areas) = 'array' AND v_project_id IS NOT NULL THEN
    FOR v_area IN SELECT * FROM jsonb_to_recordset(p_areas)
      AS x(name text, floor text, area_type text, unit_name text, area_code text, description text)
    LOOP
      v_unit_id := NULL;

      -- Determine unit name: explicit field, or extract from area name pattern "2A Bathroom"
      v_unit_name := v_area.unit_name;
      IF v_unit_name IS NULL THEN
        v_match := regexp_match(v_area.name, '^(\d+)([A-Z])\s');
        IF v_match IS NOT NULL THEN
          v_unit_name := v_match[1] || v_match[2];
        END IF;
      ELSE
        -- If unit_name is just a letter like "A", prepend floor
        IF length(v_unit_name) = 1 AND v_unit_name ~ '^[A-Z]$' THEN
          v_unit_name := v_area.floor || v_unit_name;
        END IF;
      END IF;

      -- Create or find unit
      IF v_unit_name IS NOT NULL AND v_area.floor IS NOT NULL THEN
        SELECT id INTO v_unit_id
        FROM units
        WHERE project_id = v_project_id AND name = v_unit_name;

        IF v_unit_id IS NULL THEN
          INSERT INTO units (project_id, floor, name, unit_type, sort_order, created_at, updated_at)
          VALUES (v_project_id, v_area.floor, v_unit_name, 'standard_2br', 0, now(), now())
          RETURNING id INTO v_unit_id;
        END IF;
      END IF;

      -- Insert area with unit_id, area_code, description
      INSERT INTO areas (project_id, name, floor, area_type, unit_id, area_code, description)
      VALUES (v_project_id, v_area.name, v_area.floor, v_area.area_type, v_unit_id, v_area.area_code, v_area.description)
      RETURNING id INTO v_area_id;

      v_areas_created := v_areas_created + 1;

      INSERT INTO area_trade_status (area_id, trade_type, effective_pct, all_gates_passed)
      SELECT v_area_id, ts.trade_name, 0, true
      FROM trade_sequences ts
      WHERE ts.project_id = v_project_id AND ts.area_type = v_area.area_type
      GROUP BY ts.trade_name;

      -- Clone task templates
      FOR v_ts IN
        SELECT DISTINCT ts.trade_name FROM trade_sequences ts
        WHERE ts.project_id = v_project_id AND ts.area_type = v_area.area_type
      LOOP
        SELECT clone_task_templates_for_area(v_area_id, v_ts.trade_name, v_area.area_type) INTO v_cloned;
        v_tasks_cloned := v_tasks_cloned + v_cloned;
      END LOOP;
    END LOOP;
  END IF;

  -- Add user to project_members
  IF v_project_id IS NOT NULL THEN
    INSERT INTO project_members (id, project_id, user_id, org_id, role, created_at)
    VALUES (gen_random_uuid(), v_project_id, p_user_id, v_org_id, v_user.role, now())
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mark onboarding complete
  UPDATE users SET onboarding_complete = true, updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_org_id,
    'project_id', v_project_id,
    'areas_created', v_areas_created,
    'tasks_cloned', v_tasks_cloned
  );
END;
$function$;
