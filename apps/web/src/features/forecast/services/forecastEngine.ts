import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { FieldReportForBurnRate, RefreshResult } from '../types';
import { AT_RISK_THRESHOLD_DAYS, BURN_RATE_WINDOW_DAYS, MS_PER_DAY } from '@/lib/constants';

/** EMA smoothing factor — α = 2/(N+1) where N=14 gives balanced weight over 2 weeks */
const EMA_SPAN = BURN_RATE_WINDOW_DAYS; // 14
const EMA_ALPHA = 2 / (EMA_SPAN + 1); // ~0.133 — 13% weight to latest rate

// ─── Pure Calculation Functions (exported for testing) ───────

/**
 * Exponential Moving Average (EMA) burn rate from field reports.
 * Gives heavier weight to the last 3 days of activity.
 * Filters non-work days: only days WITH actual reports count.
 * Returns pct/day (e.g. 3.5 = 3.5% progress per day).
 * Returns 0 if fewer than 2 reports (insufficient data — graceful failure).
 */
export function calculateBurnRate(reports: FieldReportForBurnRate[]): number {
  if (reports.length < 2) return 0;

  // Sort by date ascending
  const sorted = [...reports].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Calculate per-work-day rates (filter: only days with reports = real work days)
  const dailyRates: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const pctDelta = sorted[i].progressPct - sorted[i - 1].progressPct;
    const daysDelta =
      (new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime()) / MS_PER_DAY;

    // Only count positive progress over non-zero time spans
    if (daysDelta > 0 && pctDelta >= 0) {
      dailyRates.push(pctDelta / daysDelta);
    }
  }

  if (dailyRates.length === 0) return 0;

  // EMA: seed with first rate, then apply exponential smoothing
  let ema = dailyRates[0];
  for (let i = 1; i < dailyRates.length; i++) {
    ema = EMA_ALPHA * dailyRates[i] + (1 - EMA_ALPHA) * ema;
  }

  return ema;
}

/**
 * Projects finish date based on remaining work and burn rate.
 * Returns null if burn rate ≤ 0 (stalled — no projection possible).
 */
export function calculateProjectedFinish(
  remainingPct: number,
  burnRate: number,
  today: Date = new Date(),
): Date | null {
  if (burnRate <= 0) return null;
  if (remainingPct <= 0) return today;

  const daysRemaining = remainingPct / burnRate;
  return new Date(today.getTime() + daysRemaining * MS_PER_DAY);
}

/**
 * Delta between projected and baseline finish.
 * Positive = behind schedule, negative = ahead.
 */
export function getScheduleDelta(baselineFinish: Date, projectedFinish: Date): number {
  return Math.round((projectedFinish.getTime() - baselineFinish.getTime()) / MS_PER_DAY);
}

// ─── Orchestrator (Server Action) ───────────────────────────

/**
 * Refreshes all forecast_snapshots for a project.
 * For each schedule_item with a resolved area_id:
 *   1. Fetch 14 days of field_reports → burn rate
 *   2. Get effective_pct from area_trade_status
 *   3. Project finish date → compute delta
 *   4. UPSERT into forecast_snapshots
 * Also writes a project-level rollup row (area_id = NULL, trade_type = 'PROJECT').
 */
export async function refreshProjectForecast(projectId: string): Promise<RefreshResult> {
  'use server';
  const session = await getSession();
  if (!session) return { success: false, snapshotsWritten: 0, atRiskCount: 0 };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const windowStart = new Date(today.getTime() - BURN_RATE_WINDOW_DAYS * MS_PER_DAY)
    .toISOString()
    .split('T')[0];

  // 1. Get schedule items with resolved areas (include manual override)
  const { data: scheduleItems } = await supabase
    .from('schedule_items')
    .select('id, area_id, area_name, trade_name, baseline_finish, planned_finish, manual_override_date')
    .eq('project_id', projectId)
    .not('area_id', 'is', null);

  if (!scheduleItems?.length) {
    return { success: true, snapshotsWritten: 0, atRiskCount: 0 };
  }

  // 2. Get field reports for the 14-day window (all at once, then group)
  const areaIds = [...new Set(scheduleItems.map((s) => s.area_id!))];
  const { data: allReports } = await supabase
    .from('field_reports')
    .select('area_id, trade_name, progress_pct, created_at')
    .in('area_id', areaIds)
    .gte('created_at', windowStart)
    .order('created_at');

  // 3. Get current effective_pct for each area+trade
  const { data: allStatus } = await supabase
    .from('area_trade_status')
    .select('area_id, trade_type, effective_pct')
    .in('area_id', areaIds);

  // Index reports and status
  const reportMap = new Map<string, FieldReportForBurnRate[]>();
  for (const r of allReports ?? []) {
    const key = `${r.area_id}:${r.trade_name}`;
    if (!reportMap.has(key)) reportMap.set(key, []);
    reportMap.get(key)!.push({ progressPct: Number(r.progress_pct), createdAt: r.created_at });
  }

  const statusMap = new Map<string, number>();
  for (const s of allStatus ?? []) {
    statusMap.set(`${s.area_id}:${s.trade_type}`, Number(s.effective_pct));
  }

  // 4. Calculate per-item and collect for project rollup
  const snapshots: Array<{
    project_id: string;
    area_id: string;
    trade_type: string;
    snapshot_date: string;
    effective_pct: number;
    actual_rate: number;
    benchmark_rate: number | null;
    projected_date: string | null;
    scheduled_date: string | null;
    delta_days: number | null;
  }> = [];

  let atRiskCount = 0;
  let maxProjectedMs = 0;
  let maxBaselineMs = 0;
  let totalPctWeighted = 0;
  let itemCount = 0;

  for (const item of scheduleItems) {
    const key = `${item.area_id}:${item.trade_name}`;
    const reports = reportMap.get(key) ?? [];
    const effectivePct = statusMap.get(key) ?? 0;
    const burnRate = calculateBurnRate(reports);
    const remainingPct = Math.max(0, 100 - effectivePct);

    // Manual override takes priority over calculated projection
    const calculatedFinish = calculateProjectedFinish(remainingPct, burnRate, today);
    const projectedFinish = item.manual_override_date
      ? new Date(item.manual_override_date as string)
      : calculatedFinish;

    const baselineDate = item.baseline_finish ?? item.planned_finish;
    let deltaDays: number | null = null;

    if (projectedFinish && baselineDate) {
      deltaDays = getScheduleDelta(new Date(baselineDate), projectedFinish);
      if (deltaDays > AT_RISK_THRESHOLD_DAYS) atRiskCount++;
    }

    // Track project rollup
    if (projectedFinish) {
      maxProjectedMs = Math.max(maxProjectedMs, projectedFinish.getTime());
    }
    if (baselineDate) {
      maxBaselineMs = Math.max(maxBaselineMs, new Date(baselineDate).getTime());
    }
    totalPctWeighted += effectivePct;
    itemCount++;

    snapshots.push({
      project_id: projectId,
      area_id: item.area_id!,
      trade_type: item.trade_name,
      snapshot_date: todayISO,
      effective_pct: effectivePct,
      actual_rate: burnRate,
      benchmark_rate: null, // future: from production_benchmarks
      projected_date: projectedFinish?.toISOString().split('T')[0] ?? null,
      scheduled_date: baselineDate ?? null,
      delta_days: deltaDays,
    });
  }

  // 5. Project-level rollup: MAX projected = worst case drives project finish
  const projectRollup = {
    project_id: projectId,
    area_id: null as string | null,
    trade_type: 'PROJECT',
    snapshot_date: todayISO,
    effective_pct: itemCount > 0 ? Math.round((totalPctWeighted / itemCount) * 100) / 100 : 0,
    actual_rate: null as number | null,
    benchmark_rate: null as number | null,
    projected_date: maxProjectedMs > 0 ? new Date(maxProjectedMs).toISOString().split('T')[0] : null,
    scheduled_date: maxBaselineMs > 0 ? new Date(maxBaselineMs).toISOString().split('T')[0] : null,
    delta_days:
      maxProjectedMs > 0 && maxBaselineMs > 0
        ? Math.round((maxProjectedMs - maxBaselineMs) / MS_PER_DAY)
        : null,
  };

  // 6. UPSERT all snapshots via atomic RPC (no race conditions)
  const allRows = [...snapshots, projectRollup];

  const { error } = await supabase.rpc('upsert_forecast_snapshots', {
    p_rows: allRows,
  });

  if (error) {
    return { success: false, snapshotsWritten: 0, atRiskCount: 0 };
  }

  return { success: true, snapshotsWritten: allRows.length, atRiskCount };
}
