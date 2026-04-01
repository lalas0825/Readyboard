'use server';

import { createServiceClient } from '@/lib/supabase/service';
import type { LaborRateRow, TradeOTConfig } from './fetchLaborRates';

export async function saveLaborRates(
  projectId: string,
  rates: LaborRateRow[],
  otConfigs: TradeOTConfig[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  // Upsert labor rates
  for (const r of rates) {
    const { error } = await supabase
      .from('labor_rates')
      .upsert(
        { project_id: projectId, trade_name: r.trade_name, role: r.role, hourly_rate: r.hourly_rate, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,trade_name,role' },
      );
    if (error) return { ok: false, error: `Rate save failed: ${error.message}` };
  }

  // Update trade_sequences OT configs (update all area_type rows for each trade)
  for (const c of otConfigs) {
    const { error } = await supabase
      .from('trade_sequences')
      .update({
        straight_time_hours: c.straight_time_hours,
        ot_multiplier: c.ot_multiplier,
        dt_multiplier: c.dt_multiplier,
        saturday_rule: c.saturday_rule,
        typical_crew: c.typical_crew,
      })
      .eq('project_id', projectId)
      .eq('trade_name', c.trade_name);
    if (error) return { ok: false, error: `OT config save failed: ${error.message}` };
  }

  return { ok: true };
}
