'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { calculateBurnRate, calculateProjectedFinish, getScheduleDelta } from './forecastEngine';
import { AT_RISK_THRESHOLD_DAYS, BURN_RATE_WINDOW_DAYS, MS_PER_DAY } from '@/lib/constants';
import type { FieldReportForBurnRate } from '../types';

type CronResult = {
  projectsProcessed: number;
  totalSnapshots: number;
  totalAtRisk: number;
  errors: string[];
};

/**
 * Refreshes forecast snapshots for ALL active projects.
 * Uses service client (no session) — designed for cron/background jobs.
 * Runs every 6 hours via /api/forecast/refresh.
 */
export async function refreshAllProjectForecasts(): Promise<CronResult> {
  const supabase = createServiceClient();
  const result: CronResult = { projectsProcessed: 0, totalSnapshots: 0, totalAtRisk: 0, errors: [] };

  // Get all projects
  const { data: projects } = await supabase.from('projects').select('id, name');
  if (!projects?.length) return result;

  for (const project of projects) {
    try {
      const r = await refreshSingleProject(supabase, project.id);
      result.projectsProcessed++;
      result.totalSnapshots += r.snapshotsWritten;
      result.totalAtRisk += r.atRiskCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${project.name}: ${msg}`);
      console.error(`[Forecast Cron] Failed for ${project.name}:`, err);
    }
  }

  return result;
}

async function refreshSingleProject(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
): Promise<{ snapshotsWritten: number; atRiskCount: number }> {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const windowStart = new Date(today.getTime() - BURN_RATE_WINDOW_DAYS * MS_PER_DAY)
    .toISOString()
    .split('T')[0];

  // 1. Schedule items with resolved areas
  const { data: scheduleItems } = await supabase
    .from('schedule_items')
    .select('id, area_id, area_name, trade_name, baseline_finish, planned_finish, manual_override_date')
    .eq('project_id', projectId)
    .not('area_id', 'is', null);

  if (!scheduleItems?.length) return { snapshotsWritten: 0, atRiskCount: 0 };

  // 2. Field reports for 14-day window
  const areaIds = [...new Set(scheduleItems.map((s) => s.area_id!))];
  const { data: allReports } = await supabase
    .from('field_reports')
    .select('area_id, trade_name, progress_pct, created_at')
    .in('area_id', areaIds)
    .gte('created_at', windowStart)
    .order('created_at');

  // 3. Current effective_pct
  const { data: allStatus } = await supabase
    .from('area_trade_status')
    .select('area_id, trade_type, effective_pct')
    .in('area_id', areaIds);

  // Index
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

  // 4. Calculate per-item
  const snapshots: Record<string, unknown>[] = [];
  let atRiskCount = 0;
  let maxProjectedMs = 0;
  let maxBaselineMs = 0;
  let totalPct = 0;
  let itemCount = 0;

  for (const item of scheduleItems) {
    const key = `${item.area_id}:${item.trade_name}`;
    const reports = reportMap.get(key) ?? [];
    const effectivePct = statusMap.get(key) ?? 0;
    const burnRate = calculateBurnRate(reports);
    const remainingPct = Math.max(0, 100 - effectivePct);

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

    if (projectedFinish) maxProjectedMs = Math.max(maxProjectedMs, projectedFinish.getTime());
    if (baselineDate) maxBaselineMs = Math.max(maxBaselineMs, new Date(baselineDate).getTime());
    totalPct += effectivePct;
    itemCount++;

    snapshots.push({
      project_id: projectId,
      area_id: item.area_id,
      trade_type: item.trade_name,
      snapshot_date: todayISO,
      effective_pct: effectivePct,
      actual_rate: burnRate,
      benchmark_rate: null,
      projected_date: projectedFinish?.toISOString().split('T')[0] ?? null,
      scheduled_date: baselineDate ?? null,
      delta_days: deltaDays,
    });
  }

  // 5. Project rollup
  snapshots.push({
    project_id: projectId,
    area_id: null,
    trade_type: 'PROJECT',
    snapshot_date: todayISO,
    effective_pct: itemCount > 0 ? Math.round((totalPct / itemCount) * 100) / 100 : 0,
    actual_rate: null,
    benchmark_rate: null,
    projected_date: maxProjectedMs > 0 ? new Date(maxProjectedMs).toISOString().split('T')[0] : null,
    scheduled_date: maxBaselineMs > 0 ? new Date(maxBaselineMs).toISOString().split('T')[0] : null,
    delta_days: maxProjectedMs > 0 && maxBaselineMs > 0
      ? Math.round((maxProjectedMs - maxBaselineMs) / MS_PER_DAY)
      : null,
  });

  // 6. UPSERT
  const { error } = await supabase.rpc('upsert_forecast_snapshots', { p_rows: snapshots });
  if (error) throw new Error(`UPSERT failed: ${error.message}`);

  return { snapshotsWritten: snapshots.length, atRiskCount };
}
