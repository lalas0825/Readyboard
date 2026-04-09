-- Fix reorder_trade_sequence RPC: use positive offset instead of negative
--
-- The trade_sequences table has a CHECK constraint (sequence_order > 0),
-- so the previous two-phase update that used -sequence_order - 10000 failed
-- with "violates check constraint trade_sequences_sequence_order_check".
--
-- Fix: use +100000 offset as the temporary parking slot. The UNIQUE constraint
-- on (project_id, area_type, sequence_order) is still satisfied because:
--   - All rows get shifted by the same amount (+100000)
--   - Final values (1..N) don't collide with parked values (100001..N+100000)
--   - Different area_types can legally share sequence_order values

CREATE OR REPLACE FUNCTION public.reorder_trade_sequence(p_project_id uuid, p_ordered jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_idx int := 0;
BEGIN
  -- Phase 1: flip to LARGE POSITIVE offsets (+100000) to avoid
  -- (project_id, area_type, sequence_order) unique conflicts.
  -- Must stay positive to satisfy CHECK (sequence_order > 0).
  UPDATE trade_sequences
  SET sequence_order = sequence_order + 100000
  WHERE project_id = p_project_id;

  -- Phase 2: assign new sequence_order based on array position.
  -- Each trade_name/phase_label combination is updated across ALL area_types at once.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_ordered) LOOP
    v_idx := v_idx + 1;
    UPDATE trade_sequences
    SET sequence_order = v_idx
    WHERE project_id = p_project_id
      AND trade_name = v_item->>'trade_name'
      AND COALESCE(phase_label, '') = COALESCE(v_item->>'phase_label', '');
  END LOOP;

  -- Safety: any row not matched (shouldn't happen) gets pushed to the end
  UPDATE trade_sequences
  SET sequence_order = (
    SELECT COALESCE(MAX(sequence_order), 0) + 1
    FROM trade_sequences
    WHERE project_id = p_project_id AND sequence_order < 100000
  )
  WHERE project_id = p_project_id AND sequence_order >= 100000;
END;
$function$;
