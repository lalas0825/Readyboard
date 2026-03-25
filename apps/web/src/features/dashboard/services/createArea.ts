'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Creates a new area for a project and initializes area_trade_status rows
 * for each trade in the project's trade sequences.
 */
export async function createArea(input: {
  projectId: string;
  name: string;
  floor: string;
  areaType: string;
}): Promise<{ ok: true; areaId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  // Use service client for writes — session check above is the auth gate,
  // and RLS INSERT policies have evaluation issues with nested subqueries.
  const supabase = createServiceClient();

  // 1. Insert area
  const { data: area, error: areaError } = await supabase
    .from('areas')
    .insert({
      project_id: input.projectId,
      name: input.name,
      floor: input.floor,
      area_type: input.areaType,
    })
    .select('id')
    .single();

  if (areaError) return { ok: false, error: areaError.message };

  // 2. Get trade sequences for this project
  const { data: trades } = await supabase
    .from('trade_sequences')
    .select('trade_name')
    .eq('project_id', input.projectId);

  // 3. Create area_trade_status for each trade
  if (trades && trades.length > 0) {
    const statusRows = trades.map((t) => ({
      area_id: area.id,
      trade_type: t.trade_name,
      effective_pct: 0,
      all_gates_passed: true,
    }));

    await supabase.from('area_trade_status').insert(statusRows);
  }

  return { ok: true, areaId: area.id };
}
