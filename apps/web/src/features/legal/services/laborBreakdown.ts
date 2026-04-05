/**
 * laborBreakdown — fetch per-role cost breakdown for a trade.
 * Works with any Supabase client (service or browser).
 * Used by PDF builders for itemized role-by-role cost tables.
 */

export interface CrewRoleLine {
  role: string;
  count: number;
  ratePerHour: number;
  hours: number;
  subtotal: number;
}

export interface LaborBreakdown {
  lines: CrewRoleLine[];
  stHours: number;
  totalDailyCost: number;
}

// Supabase client type duck-typed to avoid importing the full SDK here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function fetchLaborBreakdown(
  supabase: SupabaseClient,
  projectId: string,
  tradeName: string,
): Promise<LaborBreakdown | null> {
  const [ratesResult, configResult] = await Promise.all([
    supabase
      .from('labor_rates')
      .select('role, hourly_rate')
      .eq('project_id', projectId)
      .eq('trade_name', tradeName),
    supabase
      .from('trade_sequences')
      .select('straight_time_hours, typical_crew')
      .eq('project_id', projectId)
      .eq('trade_name', tradeName)
      .maybeSingle(),
  ]);

  const rates: { role: string; hourly_rate: number }[] = ratesResult.data ?? [];
  if (rates.length === 0) return null;

  const stHours = Number(configResult.data?.straight_time_hours ?? 8);
  const crew: Record<string, number> = (configResult.data?.typical_crew as Record<string, number> | null)
    ?? { foreman: 1, journeyperson: 3, apprentice: 1 };

  const lines: CrewRoleLine[] = Object.entries(crew)
    .filter(([, count]) => count > 0)
    .map(([role, count]) => {
      const rateRecord = rates.find((r) => r.role === role);
      const ratePerHour = Number(rateRecord?.hourly_rate ?? 0);
      const subtotal = Math.round(count * ratePerHour * stHours);
      return { role, count, ratePerHour, hours: stHours, subtotal };
    });

  const totalDailyCost = lines.reduce((sum, l) => sum + l.subtotal, 0);

  return { lines, stHours, totalDailyCost };
}

/** Format role label: "journeyperson" → "Journeyperson" */
export function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
