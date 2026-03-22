'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ExecutiveReportData } from '../types';
import { AT_RISK_THRESHOLD_DAYS, MS_PER_DAY } from '@/lib/constants';

/**
 * Generates a structured executive report JSON for the GC.
 * Summarizes: Project Status, Top 3 Risks, Financial Impact, Schedule Delta.
 * Clean and dense — a GC sees "what's wrong" and "what we're doing" in <10 seconds.
 */
export async function generateExecutiveReport(
  projectId: string,
): Promise<{ ok: true; data: ExecutiveReportData } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  // ─── Parallel data fetch ───
  const [
    projectResult,
    statusResult,
    delayResult,
    forecastResult,
    scheduleResult,
    coResult,
  ] = await Promise.all([
    supabase.from('projects').select('id, name, address').eq('id', projectId).single(),
    supabase
      .from('area_trade_status')
      .select('area_id, effective_pct, areas!inner(project_id)')
      .eq('areas.project_id', projectId),
    supabase
      .from('delay_logs')
      .select(`
        id, area_id, trade_name, reason_code, daily_cost, cumulative_cost,
        started_at, legal_status, areas!inner(name, floor, project_id)
      `)
      .eq('areas.project_id', projectId)
      .is('ended_at', null)
      .order('daily_cost', { ascending: false }),
    supabase
      .from('forecast_snapshots')
      .select('area_id, trade_type, projected_date, scheduled_date, delta_days')
      .eq('project_id', projectId)
      .not('area_id', 'is', null)
      .order('delta_days', { ascending: false })
      .limit(20),
    supabase
      .from('schedule_items')
      .select('id, is_critical, manual_override_date')
      .eq('project_id', projectId),
    supabase
      .from('change_orders')
      .select('amount, status')
      .eq('project_id', projectId),
  ]);

  if (!projectResult.data) return { ok: false, error: 'Project not found' };

  // ─── Project Status ───
  const cells = statusResult.data ?? [];
  const uniqueAreas = new Set(cells.map((c) => c.area_id as string));
  const overallPct =
    cells.length > 0 ? cells.reduce((s, c) => s + Number(c.effective_pct), 0) / cells.length : 0;

  // ─── Schedule ───
  const scheduleItems = scheduleResult.data ?? [];
  const criticalPathItems = scheduleItems.filter((s) => s.is_critical).length;
  const manualOverrides = scheduleItems.filter((s) => s.manual_override_date).length;

  // Project-level forecast (latest snapshot)
  const projectSnapshot = (forecastResult.data ?? []).find((s) => !s.area_id);
  // Fall back to area-level data for schedule info
  const latestWithSchedule = forecastResult.data?.find((s) => s.scheduled_date && s.projected_date);

  // ─── Top 3 Risks (at_risk items sorted by delta DESC) ───
  const atRiskItems = (forecastResult.data ?? [])
    .filter((s) => s.area_id && s.delta_days != null && s.delta_days > AT_RISK_THRESHOLD_DAYS);

  // Resolve area names for risks
  const riskAreaIds = [...new Set(atRiskItems.map((r) => r.area_id))];
  let areaNameMap = new Map<string, string>();
  if (riskAreaIds.length > 0) {
    const { data: areas } = await supabase
      .from('areas')
      .select('id, name')
      .in('id', riskAreaIds);
    for (const a of areas ?? []) {
      areaNameMap.set(a.id, a.name);
    }
  }

  const topRisks = atRiskItems.slice(0, 3).map((r) => ({
    areaName: areaNameMap.get(r.area_id) ?? 'Unknown',
    tradeName: r.trade_type,
    deltaDays: r.delta_days!,
    baselineFinish: r.scheduled_date,
    projectedDate: r.projected_date,
    isCritical: scheduleItems.some(
      (s) => s.is_critical && riskAreaIds.includes(r.area_id),
    ),
  }));

  // ─── Financial ───
  const delays = delayResult.data ?? [];
  const totalDelayCost = delays.reduce((s, d) => s + Number(d.cumulative_cost ?? 0), 0);
  const cos = coResult.data ?? [];
  const totalApprovedCOs = cos
    .filter((c) => c.status === 'approved')
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalPendingCOs = cos
    .filter((c) => c.status === 'pending')
    .reduce((s, c) => s + Number(c.amount), 0);

  // ─── Active Delays ───
  const activeDelays = delays.map((d) => {
    const area = d.areas as unknown as Record<string, unknown>;
    return {
      areaName: (area.name as string) ?? 'Unknown',
      tradeName: d.trade_name,
      reasonCode: d.reason_code,
      daysBlocked: Math.ceil((Date.now() - new Date(d.started_at).getTime()) / MS_PER_DAY),
      dailyCost: Number(d.daily_cost),
      cumulativeCost: Number(d.cumulative_cost),
      legalStatus: (d.legal_status as string) ?? null,
    };
  });

  const report: ExecutiveReportData = {
    generatedAt: new Date().toISOString(),
    project: {
      id: projectId,
      name: projectResult.data.name,
      address: projectResult.data.address,
      overallPct: Math.round(overallPct * 100) / 100,
      totalAreas: uniqueAreas.size,
      areasOnTrack: uniqueAreas.size - atRiskItems.length,
      areasAtRisk: atRiskItems.length,
    },
    schedule: {
      scheduledFinish: projectSnapshot?.scheduled_date ?? latestWithSchedule?.scheduled_date ?? null,
      projectedFinish: projectSnapshot?.projected_date ?? latestWithSchedule?.projected_date ?? null,
      deltaDays: projectSnapshot?.delta_days ?? latestWithSchedule?.delta_days ?? null,
      criticalPathItems,
      manualOverrides,
    },
    topRisks,
    financial: {
      totalDelayCost: Math.round(totalDelayCost * 100) / 100,
      totalApprovedCOs: Math.round(totalApprovedCOs * 100) / 100,
      totalPendingCOs: Math.round(totalPendingCOs * 100) / 100,
      totalFinancialImpact: Math.round((totalDelayCost + totalApprovedCOs) * 100) / 100,
      activeDelays: delays.length,
    },
    activeDelays,
  };

  return { ok: true, data: report };
}
