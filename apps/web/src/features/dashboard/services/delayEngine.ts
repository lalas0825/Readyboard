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

  // Batch-fetch everything needed to compute per-trade costs in-memory
  const [projectResult, logsResult, ratesResult, tradeConfigResult] = await Promise.all([
    supabase.from('projects').select('labor_rate_per_hour').eq('id', projectId).single(),
    supabase
      .from('delay_logs')
      .select(`
        id, area_id, trade_name, reason_code, crew_size,
        started_at, ended_at, legal_status,
        man_hours, daily_cost, cumulative_cost,
        areas!inner ( name, floor, project_id )
      `)
      .eq('areas.project_id', projectId)
      .order('started_at', { ascending: false }),
    supabase.from('labor_rates').select('trade_name, role, hourly_rate').eq('project_id', projectId),
    supabase.from('trade_sequences').select('trade_name, straight_time_hours, ot_multiplier, typical_crew').eq('project_id', projectId),
  ]);

  if (logsResult.error || !logsResult.data) return emptyResult();
  const logs = logsResult.data;
  const fallbackRate = Number(projectResult.data?.labor_rate_per_hour ?? 0);

  // Build lookup maps: trade_name → rates/config
  type RateRow = { role: string; hourly_rate: number };
  const ratesByTrade = new Map<string, RateRow[]>();
  for (const r of (ratesResult.data ?? [])) {
    if (!ratesByTrade.has(r.trade_name)) ratesByTrade.set(r.trade_name, []);
    ratesByTrade.get(r.trade_name)!.push({ role: r.role, hourly_rate: Number(r.hourly_rate) });
  }
  const configByTrade = new Map<string, { stHours: number; otMult: number; crew: Record<string, number> }>();
  for (const t of (tradeConfigResult.data ?? [])) {
    if (!configByTrade.has(t.trade_name)) {
      configByTrade.set(t.trade_name, {
        stHours: Number(t.straight_time_hours ?? 8),
        otMult: Number(t.ot_multiplier ?? 1.5),
        crew: (t.typical_crew as Record<string, number> | null) ?? { foreman: 1, journeyperson: 3, apprentice: 1 },
      });
    }
  }

  /** Compute daily cost in-memory from labor_rates + trade_sequences */
  function computeDailyCost(tradeName: string): number {
    const tradeRates = ratesByTrade.get(tradeName);
    if (!tradeRates || tradeRates.length === 0) {
      return Math.round(4 * fallbackRate * 8); // 4 workers × flat rate × 8h
    }
    const cfg = configByTrade.get(tradeName) ?? { stHours: 8, otMult: 1.5, crew: { foreman: 1, journeyperson: 3, apprentice: 1 } };
    return Object.entries(cfg.crew)
      .filter(([, count]) => count > 0)
      .reduce((sum, [role, count]) => {
        const rate = tradeRates.find((r) => r.role === role)?.hourly_rate ?? 0;
        return sum + Math.round(count * rate * cfg.stHours);
      }, 0);
  }

  const now = Date.now();
  const delays: DelayLogSummary[] = logs.map((log) => {
    const area = log.areas as unknown as Record<string, unknown>;
    const isActive = !log.ended_at;
    const crewSize = log.crew_size ?? 1;
    const legalStatus = (log.legal_status as DelayLegalStatus) ?? null;
    const isLegallyLocked = legalStatus === 'draft' || legalStatus === 'sent' || legalStatus === 'signed';

    let durationHours: number;
    let manHours: number;
    let cumulativeCost: number;

    const dailyCost = Number(log.daily_cost) || computeDailyCost(log.trade_name);
    const effectiveRate = crewSize > 0 ? dailyCost / (crewSize * 8) : fallbackRate;

    if (isLegallyLocked || !isActive) {
      durationHours = crewSize > 0 ? Number(log.man_hours) / crewSize : 0;
      manHours = Number(log.man_hours);
      cumulativeCost = Number(log.cumulative_cost) || Math.round(manHours * effectiveRate);
    } else {
      durationHours = (now - new Date(log.started_at).getTime()) / MS_PER_HOUR;
      manHours = Math.round(durationHours * crewSize * 100) / 100;
      cumulativeCost = Math.round(manHours * effectiveRate * 100) / 100;
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
      dailyCost,
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
