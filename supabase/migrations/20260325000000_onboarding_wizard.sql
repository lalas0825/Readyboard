-- 1. Add onboarding_complete flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- 2. RPC: clone_task_templates_for_area
CREATE OR REPLACE FUNCTION clone_task_templates_for_area(
  p_area_id uuid,
  p_trade_type text,
  p_area_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO area_tasks (
    area_id, trade_type, task_template_id, task_order,
    task_name_en, task_name_es, task_owner, is_gate, weight, status
  )
  SELECT
    p_area_id, p_trade_type, t.id, t.task_order,
    t.task_name_en, t.task_name_es, t.task_owner, t.is_gate, t.weight, 'pending'
  FROM trade_task_templates t
  WHERE t.org_id IS NULL
    AND t.trade_type = p_trade_type
    AND t.area_type = p_area_type
    AND t.default_enabled = true
  ORDER BY t.task_order;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 3. RPC: complete_onboarding — atomic transaction for the entire wizard
CREATE OR REPLACE FUNCTION complete_onboarding(
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
SET search_path = 'public'
AS $$
DECLARE
  v_user record;
  v_org_id uuid;
  v_project_id uuid;
  v_area record;
  v_area_id uuid;
  v_trade record;
  v_areas_created integer := 0;
  v_tasks_cloned integer := 0;
BEGIN
  SELECT id, org_id, role INTO v_user FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  v_org_id := v_user.org_id;

  UPDATE organizations
  SET name = p_org_name, default_language = p_org_language, updated_at = now()
  WHERE id = v_org_id;

  IF p_project_name IS NOT NULL THEN
    SELECT id INTO v_project_id
    FROM projects WHERE gc_org_id = v_org_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_project_id IS NOT NULL THEN
      UPDATE projects
      SET name = p_project_name, address = p_project_address,
          labor_rate_per_hour = p_labor_rate, legal_jurisdiction = p_jurisdiction,
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

  IF p_trades IS NOT NULL AND v_project_id IS NOT NULL THEN
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

  IF p_areas IS NOT NULL AND v_project_id IS NOT NULL THEN
    FOR v_area IN SELECT * FROM jsonb_to_recordset(p_areas) AS x(name text, floor text, area_type text)
    LOOP
      INSERT INTO areas (project_id, name, floor, area_type)
      VALUES (v_project_id, v_area.name, v_area.floor, v_area.area_type)
      RETURNING id INTO v_area_id;

      v_areas_created := v_areas_created + 1;

      INSERT INTO area_trade_status (area_id, trade_type, effective_pct, all_gates_passed)
      SELECT v_area_id, ts.trade_name, 0, true
      FROM trade_sequences ts
      WHERE ts.project_id = v_project_id AND ts.area_type = v_area.area_type
      GROUP BY ts.trade_name;

      DECLARE
        v_ts record;
        v_cloned integer;
      BEGIN
        FOR v_ts IN
          SELECT DISTINCT ts.trade_name FROM trade_sequences ts
          WHERE ts.project_id = v_project_id AND ts.area_type = v_area.area_type
        LOOP
          SELECT clone_task_templates_for_area(v_area_id, v_ts.trade_name, v_area.area_type) INTO v_cloned;
          v_tasks_cloned := v_tasks_cloned + v_cloned;
        END LOOP;
      END;
    END LOOP;
  END IF;

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
$$;
