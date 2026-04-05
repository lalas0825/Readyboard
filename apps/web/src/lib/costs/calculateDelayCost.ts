import { createClient } from '@/lib/supabase/server';

export interface CrewMember {
  role: string;
  count: number;
  rate: number;
  hours: number;
  subtotal: number;
}

export interface DelayCostResult {
  dailyCost: number;
  straightTimeCost: number;
  overtimeCost: number;
  breakdown: CrewMember[];
  hoursPerDay: number;
}

/**
 * Calculates the daily cost of a delay for a specific trade using per-trade labor rates.
 * Falls back to projects.labor_rate_per_hour × 4 workers × 8h if no specific rates exist.
 */
export async function calculateDelayCost(
  projectId: string,
  tradeName: string,
  hoursBlocked?: number,
): Promise<DelayCostResult> {
  const supabase = await createClient();

  const [ratesResult, tradeConfigResult] = await Promise.all([
    supabase
      .from('labor_rates')
      .select('role, hourly_rate')
      .eq('project_id', projectId)
      .eq('trade_name', tradeName),
    supabase
      .from('trade_sequences')
      .select('straight_time_hours, ot_multiplier, typical_crew')
      .eq('project_id', projectId)
      .eq('trade_name', tradeName)
      .maybeSingle(),
  ]);

  const rates = ratesResult.data ?? [];

  // Fallback: no per-trade rates → use flat project rate
  if (rates.length === 0) {
    const { data: project } = await supabase
      .from('projects')
      .select('labor_rate_per_hour')
      .eq('id', projectId)
      .single();

    const fallbackRate = Number(project?.labor_rate_per_hour ?? 100);
    const hrs = hoursBlocked ?? 8;
    const workerCount = 4;
    const subtotal = Math.round(workerCount * fallbackRate * hrs);

    return {
      dailyCost: subtotal,
      straightTimeCost: subtotal,
      overtimeCost: 0,
      breakdown: [{ role: 'worker', count: workerCount, rate: fallbackRate, hours: hrs, subtotal }],
      hoursPerDay: 8,
    };
  }

  const stHours = Number(tradeConfigResult.data?.straight_time_hours ?? 8);
  const otMultiplier = Number(tradeConfigResult.data?.ot_multiplier ?? 1.5);
  const crew = (tradeConfigResult.data?.typical_crew as Record<string, number> | null)
    ?? { foreman: 1, journeyperson: 3, apprentice: 1 };

  const hrs = hoursBlocked ?? stHours;

  const breakdown: CrewMember[] = Object.entries(crew)
    .filter(([, count]) => count > 0)
    .map(([role, count]) => {
      const rateRecord = rates.find((r) => r.role === role);
      const rate = Number(rateRecord?.hourly_rate ?? 0);

      const stHrs = Math.min(hrs, stHours);
      const otHrs = Math.max(0, hrs - stHours);
      const subtotal = Math.round(count * rate * stHrs + count * rate * otMultiplier * otHrs);

      return { role, count, rate, hours: hrs, subtotal };
    });

  const totalCost = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const stTotal = breakdown.reduce((sum, b) => {
    const stHrs = Math.min(hrs, stHours);
    return sum + b.count * b.rate * stHrs;
  }, 0);

  return {
    dailyCost: Math.round(totalCost),
    straightTimeCost: Math.round(stTotal),
    overtimeCost: Math.round(totalCost - stTotal),
    breakdown,
    hoursPerDay: stHours,
  };
}
