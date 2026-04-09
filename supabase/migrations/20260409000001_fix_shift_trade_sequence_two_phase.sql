-- Fix shift_trade_sequence RPC: two-phase update to avoid UNIQUE conflicts
--
-- When shifting sequence_order +1, the single UPDATE statement could cause
-- momentary collisions on the UNIQUE (project_id, area_type, sequence_order)
-- constraint. Example: shifting rows 5,6,7 by +1 → row 5→6 collides with
-- existing row 6 before row 6 becomes 7.
--
-- Fix: park affected rows at +100000 first, then apply the real shift.

CREATE OR REPLACE FUNCTION public.shift_trade_sequence(p_project_id uuid, p_area_type text, p_after_order integer, p_shift_by integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Phase 1: park affected rows at sequence_order + 100000
  UPDATE trade_sequences
  SET sequence_order = sequence_order + 100000
  WHERE project_id = p_project_id
    AND area_type = p_area_type
    AND sequence_order > p_after_order;

  -- Phase 2: apply the actual shift from the parked values
  UPDATE trade_sequences
  SET sequence_order = sequence_order - 100000 + p_shift_by
  WHERE project_id = p_project_id
    AND area_type = p_area_type
    AND sequence_order >= 100000;
END;
$function$;
