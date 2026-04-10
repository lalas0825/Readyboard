'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export type FloorTradeCell = {
  floor: string;
  tradeName: string;
  /** Worst-case status across all areas on this floor for this trade */
  status: string | null;
  /** Earliest started_at across areas */
  actualStart: string | null;
  /** Latest completed_at across areas (null if any area incomplete) */
  actualEnd: string | null;
};

export async function fetchFloorTradeMatrix(
  projectId: string,
): Promise<FloorTradeCell[]> {
  const session = await getSession();
  if (!session) return [];

  // Service client needed: area_trade_status has RLS that requires session;
  // dev bypass uses service client.
  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  // Join area_trade_status → areas to get floor + trade aggregated per floor
  const { data } = await supabase
    .from('area_trade_status')
    .select(
      'trade_type, gc_verification_pending, effective_pct, started_at, completed_at, areas!inner(floor, project_id)',
    )
    .eq('areas.project_id', projectId);

  if (!data) return [];

  // Aggregate: per (floor, trade_type) pick worst status + date range
  const map = new Map<string, FloorTradeCell>();

  for (const row of data) {
    const areas = row.areas as unknown as { floor: string; project_id: string };
    const floor = areas.floor as string;
    const tradeName = row.trade_type as string;
    const key = `${floor}||${tradeName}`;

    const existing = map.get(key);

    // Determine status label from effective_pct + gc_verification_pending
    const pct = (row.effective_pct as number) ?? 0;
    let status: string;
    if (pct >= 100) status = 'DONE';
    else if (pct >= 1) status = 'IN_PROGRESS';
    else status = 'PENDING';
    if (row.gc_verification_pending) status = 'PENDING_GC';

    // Merge: keep worst status (DONE < IN_PROGRESS < PENDING_GC < PENDING)
    const statusOrder: Record<string, number> = {
      DONE: 0,
      IN_PROGRESS: 1,
      PENDING_GC: 2,
      PENDING: 3,
    };

    if (!existing) {
      map.set(key, {
        floor,
        tradeName,
        status,
        actualStart: (row.started_at as string) ?? null,
        actualEnd: (row.completed_at as string) ?? null,
      });
    } else {
      // Keep worst status
      if ((statusOrder[status] ?? 99) > (statusOrder[existing.status ?? 'DONE'] ?? 0)) {
        existing.status = status;
      }
      // Earliest start
      if (row.started_at && (!existing.actualStart || row.started_at < existing.actualStart)) {
        existing.actualStart = row.started_at as string;
      }
      // Latest end — only set if all areas complete (approximation: if this one is null, clear)
      if (!row.completed_at) {
        existing.actualEnd = null;
      } else if (existing.actualEnd && row.completed_at > existing.actualEnd) {
        existing.actualEnd = row.completed_at as string;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.tradeName !== b.tradeName) return a.tradeName.localeCompare(b.tradeName);
    return a.floor.localeCompare(b.floor, undefined, { numeric: true });
  });
}
