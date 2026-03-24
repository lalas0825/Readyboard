'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type VerificationQueueItem = {
  areaId: string;
  areaName: string;
  floor: string;
  tradeType: string;
  effectivePct: number;
  pendingSince: string;
  hoursWaiting: number;
};

/**
 * Fetches all area/trade pairs awaiting GC verification.
 * Ordered by gc_verification_pending_since ASC (FIFO — oldest first).
 * hoursWaiting calculated server-side per Sensei directive.
 */
export async function fetchVerificationQueue(
  projectId: string,
): Promise<VerificationQueueItem[]> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('area_trade_status')
    .select(`
      area_id,
      trade_type,
      effective_pct,
      gc_verification_pending_since,
      areas!inner ( id, name, floor, project_id )
    `)
    .eq('gc_verification_pending', true)
    .eq('areas.project_id', projectId)
    .order('gc_verification_pending_since', { ascending: true });

  if (error || !data) return [];

  const now = Date.now();

  return data.map((row) => {
    const area = row.areas as unknown as Record<string, unknown>;
    const pendingSince = (row.gc_verification_pending_since as string) ?? new Date().toISOString();
    const hoursWaiting = Math.max(0, (now - new Date(pendingSince).getTime()) / 3_600_000);

    return {
      areaId: area.id as string,
      areaName: (area.name as string) ?? 'Unknown',
      floor: (area.floor as string) ?? '-',
      tradeType: row.trade_type as string,
      effectivePct: (row.effective_pct as number) ?? 0,
      pendingSince,
      hoursWaiting: Math.round(hoursWaiting * 10) / 10,
    };
  });
}
