-- Week 5: Atomic P6/CSV schedule import — single transaction, full rollback on any failure
CREATE OR REPLACE FUNCTION import_schedule_batch(
  p_project_id UUID,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  item JSONB;
  resolved_area_id UUID;
  upserted_count INT := 0;
  critical_count INT := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Resolve area_name → area_id (nullable if no match)
    SELECT id INTO resolved_area_id
    FROM areas
    WHERE project_id = p_project_id
      AND name = item->>'area_name'
    LIMIT 1;

    INSERT INTO schedule_items (
      project_id, area_name, trade_name, planned_start, planned_finish,
      baseline_finish, p6_activity_id, area_id, is_critical
    ) VALUES (
      p_project_id,
      item->>'area_name',
      item->>'trade_name',
      (item->>'planned_start')::DATE,
      (item->>'planned_finish')::DATE,
      (item->>'baseline_finish')::DATE,
      item->>'p6_activity_id',
      resolved_area_id,
      COALESCE((item->>'is_critical')::BOOLEAN, false)
    )
    ON CONFLICT (project_id, p6_activity_id)
    DO UPDATE SET
      planned_start = EXCLUDED.planned_start,
      planned_finish = EXCLUDED.planned_finish,
      -- WRITE-ONCE: baseline_finish never overwritten once set
      baseline_finish = COALESCE(schedule_items.baseline_finish, EXCLUDED.baseline_finish),
      area_id = COALESCE(EXCLUDED.area_id, schedule_items.area_id),
      is_critical = EXCLUDED.is_critical,
      updated_at = NOW();

    upserted_count := upserted_count + 1;
    IF COALESCE((item->>'is_critical')::BOOLEAN, false) THEN
      critical_count := critical_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'upserted', upserted_count,
    'critical', critical_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
