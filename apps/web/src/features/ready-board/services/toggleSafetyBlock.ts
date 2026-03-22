'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

type ToggleSafetyBlockInput = {
  areaId: string;
  tradeName: string;
};

type ToggleSafetyBlockResult =
  | { ok: true; action: 'blocked' | 'unblocked' }
  | { ok: false; error: string };

/**
 * Toggles safety block for an area+trade.
 * Reuses the delay_logs mechanism: creates a delay with reason_code='safety'
 * to block, or sets ended_at to unblock.
 */
export async function toggleSafetyBlock(
  input: ToggleSafetyBlockInput,
): Promise<ToggleSafetyBlockResult> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Check for existing active safety delay
  const { data: existing } = await supabase
    .from('delay_logs')
    .select('id')
    .eq('area_id', input.areaId)
    .eq('trade_name', input.tradeName)
    .eq('reason_code', 'safety')
    .is('ended_at', null)
    .maybeSingle();

  if (existing) {
    // Unblock: close the safety delay
    const { error } = await supabase
      .from('delay_logs')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true, action: 'unblocked' };
  }

  // Block: create a safety delay (zero cost — administrative block)
  const { error } = await supabase
    .from('delay_logs')
    .insert({
      area_id: input.areaId,
      trade_name: input.tradeName,
      reason_code: 'safety',
      started_at: new Date().toISOString(),
      man_hours: 0,
      daily_cost: 0,
      cumulative_cost: 0,
      crew_size: 1,
    });

  if (error) return { ok: false, error: error.message };
  return { ok: true, action: 'blocked' };
}
