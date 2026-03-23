'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type EligibleDelay = {
  id: string;
  areaName: string;
  tradeName: string;
  reasonCode: string;
  cumulativeCost: number;
  manHours: number;
  startedAt: string;
};

/**
 * Fetches delay_logs eligible for REA generation:
 * - legal_status = 'sent' (NOD already sent)
 * - No existing rea_id (not already linked to an REA)
 * - Same project scope
 */
export async function fetchDelayLogsForRea(projectId: string): Promise<EligibleDelay[]> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('delay_logs')
    .select(`
      id, trade_name, reason_code, cumulative_cost, man_hours, started_at,
      areas!inner ( name, project_id )
    `)
    .eq('areas.project_id', projectId)
    .eq('legal_status', 'sent')
    .is('rea_id', null)
    .order('cumulative_cost', { ascending: false });

  if (error || !data) return [];

  return data.map((d) => {
    const area = d.areas as unknown as Record<string, unknown>;
    return {
      id: d.id,
      areaName: (area.name as string) ?? 'Unknown',
      tradeName: d.trade_name,
      reasonCode: d.reason_code,
      cumulativeCost: Number(d.cumulative_cost ?? 0),
      manHours: Number(d.man_hours ?? 0),
      startedAt: d.started_at,
    };
  });
}
