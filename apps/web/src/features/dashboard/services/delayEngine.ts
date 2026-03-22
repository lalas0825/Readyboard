'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { MS_PER_HOUR } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────

export type DelayLegalStatus = 'pending' | 'draft' | 'sent' | 'signed' | null;

export type DelayLogSummary = {
  id: string;
  areaId: string;
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  crewSize: number;
  startedAt: string;
  endedAt: string | null;
  /** Duration in hours (real-time for active, final for closed) */
  durationHours: number;
  /** crew_size × duration_hours */
  manHours: number;
  /** crew_size × 8h × labor_rate (per day) */
  dailyCost: number;
  /** man_hours × labor_rate (total accumulated) */
  cumulativeCost: number;
  isActive: boolean;
  /** Legal lifecycle: null → pending → draft → sent → signed */
  legalStatus: DelayLegalStatus;
};

export type DelayEngineResult = {
  delays: DelayLogSummary[];
  totals: {
    activeCount: number;
    closedCount: number;
    totalManHours: number;
    totalDailyCost: number;
    totalCumulativeCost: number;
  };
};

// ─── Engine ─────────────────────────────────────────

/**
 * Fetches all delay logs for a project with real-time cost calculations.
 *
 * Costs are computed by PostgreSQL triggers (recalculate_delay_costs)
 * on every INSERT/UPDATE, so the values in the table are always fresh
 * for closed delays. For active delays, we recalculate client-side
 * using the same formula for display freshness.
 */
export async function getDelayLogSummary(
  projectId: string,
): Promise<DelayEngineResult> {
  const session = await getSession();
  if (!session) return emptyResult();

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Get project labor rate
  const { data: project } = await supabase
    .from('projects')
    .select('labor_rate_per_hour')
    .eq('id', projectId)
    .single();

  const laborRate = Number(project?.labor_rate_per_hour ?? 0);

  // Get all delay logs for this project
  const { data: logs, error } = await supabase
    .from('delay_logs')
    .select(`
      id, area_id, trade_name, reason_code, crew_size,
      started_at, ended_at, legal_status,
      man_hours, daily_cost, cumulative_cost,
      areas!inner ( name, floor, project_id )
    `)
    .eq('areas.project_id', projectId)
    .order('started_at', { ascending: false });

  if (error || !logs) return emptyResult();

  const now = Date.now();
  const delays: DelayLogSummary[] = logs.map((log) => {
    const area = log.areas as unknown as Record<string, unknown>;
    const isActive = !log.ended_at;
    const crewSize = log.crew_size ?? 1;
    const legalStatus = (log.legal_status as DelayLegalStatus) ?? null;
    const isLegallyLocked = legalStatus === 'draft' || legalStatus === 'sent' || legalStatus === 'signed';

    // For legally locked delays, always use DB values (costs are finalized).
    // For active delays without legal lock, compute fresh duration.
    // For closed delays, use DB values.
    let durationHours: number;
    let manHours: number;
    let cumulativeCost: number;

    if (isLegallyLocked || !isActive) {
      durationHours = crewSize > 0 ? Number(log.man_hours) / crewSize : 0;
      manHours = Number(log.man_hours);
      cumulativeCost = Number(log.cumulative_cost);
    } else {
      durationHours = (now - new Date(log.started_at).getTime()) / MS_PER_HOUR;
      manHours = Math.round(durationHours * crewSize * 100) / 100;
      cumulativeCost = Math.round(manHours * laborRate * 100) / 100;
    }

    return {
      id: log.id,
      areaId: log.area_id,
      areaName: (area.name as string) ?? 'Unknown',
      floor: (area.floor as string) ?? '?',
      tradeName: log.trade_name,
      reasonCode: log.reason_code,
      crewSize,
      startedAt: log.started_at,
      endedAt: log.ended_at,
      durationHours: Math.round(durationHours * 100) / 100,
      manHours,
      dailyCost: Number(log.daily_cost),
      cumulativeCost,
      isActive,
      legalStatus,
    };
  });

  const activeDelays = delays.filter((d) => d.isActive);
  const closedDelays = delays.filter((d) => !d.isActive);

  return {
    delays,
    totals: {
      activeCount: activeDelays.length,
      closedCount: closedDelays.length,
      totalManHours: sum(delays, 'manHours'),
      totalDailyCost: sum(activeDelays, 'dailyCost'),
      totalCumulativeCost: sum(delays, 'cumulativeCost'),
    },
  };
}

// ─── Helpers ────────────────────────────────────────

function emptyResult(): DelayEngineResult {
  return {
    delays: [],
    totals: { activeCount: 0, closedCount: 0, totalManHours: 0, totalDailyCost: 0, totalCumulativeCost: 0 },
  };
}

function sum(items: DelayLogSummary[], key: keyof DelayLogSummary): number {
  return Math.round(items.reduce((acc, d) => acc + (d[key] as number), 0) * 100) / 100;
}
