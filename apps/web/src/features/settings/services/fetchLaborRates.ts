'use server';

import { createServiceClient } from '@/lib/supabase/service';

export type LaborRateRow = {
  trade_name: string;
  role: string;
  hourly_rate: number;
};

export type TradeOTConfig = {
  trade_name: string;
  straight_time_hours: number;
  ot_multiplier: number;
  dt_multiplier: number;
  saturday_rule: string;
  typical_crew: Record<string, number>;
};

export async function fetchLaborRates(projectId: string): Promise<{
  rates: LaborRateRow[];
  otConfigs: TradeOTConfig[];
}> {
  const supabase = createServiceClient();

  const { data: rateRows } = await supabase
    .from('labor_rates')
    .select('trade_name, role, hourly_rate')
    .eq('project_id', projectId)
    .order('trade_name')
    .order('role');

  const { data: seqRows } = await supabase
    .from('trade_sequences')
    .select('trade_name, straight_time_hours, ot_multiplier, dt_multiplier, saturday_rule, typical_crew')
    .eq('project_id', projectId);

  // Deduplicate trade_sequences (one per trade, not per area_type)
  const otMap = new Map<string, TradeOTConfig>();
  for (const s of seqRows ?? []) {
    if (!otMap.has(s.trade_name)) {
      otMap.set(s.trade_name, {
        trade_name: s.trade_name,
        straight_time_hours: Number(s.straight_time_hours ?? 8),
        ot_multiplier: Number(s.ot_multiplier ?? 1.5),
        dt_multiplier: Number(s.dt_multiplier ?? 2),
        saturday_rule: (s.saturday_rule as string) ?? 'ot',
        typical_crew: (s.typical_crew as Record<string, number>) ?? { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 },
      });
    }
  }

  return {
    rates: (rateRows ?? []).map((r) => ({
      trade_name: r.trade_name,
      role: r.role,
      hourly_rate: Number(r.hourly_rate),
    })),
    otConfigs: Array.from(otMap.values()),
  };
}
