'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { DashboardData, ProjectMetrics, DashboardAlert, ProjectForecast, TrendSnapshot, FinancialOverview, ScheduleComparisonRow } from '../types';
import { AT_RISK_THRESHOLD_DAYS, BURN_RATE_WINDOW_DAYS, MS_PER_DAY } from '@/lib/constants';
import { notificationTrigger } from './notificationTrigger';

function emptyDashboardData(): DashboardData {
  return {
    metrics: { projectId: '', projectName: '', overallPct: 0, totalAreas: 0, onTrack: 0, attention: 0, actionRequired: 0 },
    alerts: [],
    forecast: { trendData: [], scheduledDate: null, projectedDate: null, deltaDays: null, atRiskCount: 0, criticalPathItems: 0 },
    financial: { totalDelayCost: 0, totalChangeOrderAmount: 0, totalFinancialImpact: 0, pendingCOs: 0 },
    scheduleComparison: [],
  };
}

/**
 * Server action: fetches aggregated dashboard data for the GC Overview.
 * Runs 4 queries in parallel. Each query is individually resilient —
 * a failed sub-query returns empty/zero data instead of failing the whole dashboard.
 */
export async function fetchDashboardData(
  projectId?: string,
): Promise<DashboardData> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Resolve projectId
  let pid = projectId;
  if (!pid) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .limit(1)
      .single();
    pid = project?.id;
  }

  if (!pid) return emptyDashboardData();

  // Run all queries in parallel — each wrapped for resilience
  const [metrics, alerts, forecast, financial, scheduleComparison, projectInfo] = await Promise.all([
    fetchMetrics(supabase, pid),
    fetchAlerts(supabase, pid),
    fetchForecast(supabase, pid),
    fetchFinancial(supabase, pid),
    fetchScheduleComparison(supabase, pid),
    supabase.from('projects').select('name').eq('id', pid).single(),
  ]);

  // Non-blocking side effect — notifications never block dashboard rendering
  notificationTrigger(pid).catch(() => {/* silent */});

  return {
    metrics: { ...metrics, projectId: pid, projectName: projectInfo.data?.name ?? '' },
    alerts,
    forecast,
    financial,
    scheduleComparison,
  };
}

// ─── Metrics (Section 1) ─────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function fetchMetrics(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Omit<ProjectMetrics, 'projectId' | 'projectName'>> {
  try {
    // All area_trade_status for this project
    const { data: rows } = await supabase
      .from('area_trade_status')
      .select('area_id, effective_pct, gc_verification_pending, areas!inner(project_id)')
      .eq('areas.project_id', projectId);

    // Active delays — scoped to current project
    const { data: delayRows } = await supabase
      .from('delay_logs')
      .select('area_id, areas!inner(project_id)')
      .eq('areas.project_id', projectId)
      .is('ended_at', null);

    const delayedAreaIds = new Set((delayRows ?? []).map((d) => d.area_id));
    const cells = rows ?? [];

    if (cells.length === 0) {
      return { overallPct: 0, totalAreas: 0, onTrack: 0, attention: 0, actionRequired: 0 };
    }

    // Overall %: average of all effective_pct
    const totalPct = cells.reduce((sum, c) => sum + Number(c.effective_pct), 0);
    const overallPct = totalPct / cells.length;

    // Count unique areas by status category
    const areaStatus = new Map<string, 'on_track' | 'attention' | 'action_required'>();
    for (const cell of cells) {
      const areaId = cell.area_id as string;
      const existing = areaStatus.get(areaId);

      // Action required = has active delay
      if (delayedAreaIds.has(areaId)) {
        areaStatus.set(areaId, 'action_required');
        continue;
      }

      // Attention = GC verification pending
      if (cell.gc_verification_pending && existing !== 'action_required') {
        areaStatus.set(areaId, 'attention');
        continue;
      }

      // On track = no delay, no pending verification
      if (!existing) {
        areaStatus.set(areaId, 'on_track');
      }
    }

    let onTrack = 0;
    let attention = 0;
    let actionRequired = 0;
    for (const status of areaStatus.values()) {
      if (status === 'on_track') onTrack++;
      else if (status === 'attention') attention++;
      else actionRequired++;
    }

    return { overallPct, totalAreas: areaStatus.size, onTrack, attention, actionRequired };
  } catch {
    return { overallPct: 0, totalAreas: 0, onTrack: 0, attention: 0, actionRequired: 0 };
  }
}

// ─── Alerts (Section 2) ──────────────────────────────

async function fetchAlerts(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DashboardAlert[]> {
  try {
    const { data: delayRows } = await supabase
      .from('delay_logs')
      .select(`
        id,
        area_id,
        trade_name,
        reason_code,
        daily_cost,
        cumulative_cost,
        started_at,
        legal_status,
        is_change_order,
        areas!inner ( name, floor, project_id )
      `)
      .eq('areas.project_id', projectId)
      .is('ended_at', null)
      .order('daily_cost', { ascending: false })
      .limit(5);

    if (!delayRows || delayRows.length === 0) return [];

    // Check corrective actions for these delays
    const delayIds = delayRows.map((d) => d.id);
    const { data: caRows } = await supabase
      .from('corrective_actions')
      .select('id, delay_log_id, note, acknowledged_at, in_resolution_at, resolved_at')
      .in('delay_log_id', delayIds);

    const caMap = new Map<string, { status: string; id: string; note: string | null }>();
    for (const ca of caRows ?? []) {
      const status = ca.resolved_at
        ? 'resolved'
        : ca.in_resolution_at
          ? 'in_progress'
          : ca.acknowledged_at
            ? 'acknowledged'
            : 'open';
      caMap.set(ca.delay_log_id, { status, id: ca.id, note: ca.note ?? null });
    }

    return delayRows.map((d) => {
      const area = d.areas as unknown as Record<string, unknown>;
      const caInfo = caMap.get(d.id) ?? null;
      return {
        id: d.id,
        areaId: d.area_id,
        areaName: (area.name as string) ?? 'Unknown',
        floor: (area.floor as string) ?? '?',
        tradeName: d.trade_name,
        reasonCode: d.reason_code,
        dailyCost: Number(d.daily_cost),
        cumulativeCost: Number(d.cumulative_cost),
        daysBlocked: Math.ceil((Date.now() - new Date(d.started_at).getTime()) / MS_PER_DAY),
        legalStatus: (d.legal_status as string) ?? null,
        isChangeOrder: !!(d.is_change_order),
        hasCorrectiveAction: !!caInfo,
        correctiveActionStatus: caInfo?.status ?? null,
        correctiveActionId: caInfo?.id ?? null,
        correctiveActionNote: caInfo?.note ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ─── Financial (Section 4) ───────────────────────────

async function fetchFinancial(
  supabase: SupabaseClient,
  projectId: string,
): Promise<FinancialOverview> {
  try {
    const [delayResult, coResult] = await Promise.all([
      supabase
        .from('delay_logs')
        .select('cumulative_cost, areas!inner ( project_id )')
        .eq('areas.project_id', projectId),
      supabase
        .from('change_orders')
        .select('amount, status')
        .eq('project_id', projectId)
        .neq('status', 'rejected'),
    ]);

    const totalDelayCost = (delayResult.data ?? []).reduce(
      (sum, d) => sum + Number(d.cumulative_cost ?? 0),
      0,
    );

    const cos = coResult.data ?? [];
    const totalChangeOrderAmount = cos
      .filter((co) => co.status === 'approved')
      .reduce((sum, co) => sum + Number(co.amount), 0);

    const pendingCOs = cos.filter((co) => co.status === 'pending').length;

    return {
      totalDelayCost: Math.round(totalDelayCost * 100) / 100,
      totalChangeOrderAmount: Math.round(totalChangeOrderAmount * 100) / 100,
      totalFinancialImpact: Math.round((totalDelayCost + totalChangeOrderAmount) * 100) / 100,
      pendingCOs,
    };
  } catch {
    return { totalDelayCost: 0, totalChangeOrderAmount: 0, totalFinancialImpact: 0, pendingCOs: 0 };
  }
}

// ─── Forecast (Section 3) ────────────────────────────

async function fetchForecast(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectForecast> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - BURN_RATE_WINDOW_DAYS * MS_PER_DAY).toISOString().split('T')[0];

    // Parallel: project-level snapshots + at_risk count + critical path count
    const [snapshotResult, atRiskResult, criticalResult] = await Promise.all([
      supabase
        .from('forecast_snapshots')
        .select('snapshot_date, effective_pct, actual_rate, benchmark_rate, projected_date, scheduled_date')
        .eq('project_id', projectId)
        .eq('trade_type', 'PROJECT')
        .is('area_id', null)
        .gte('snapshot_date', fourteenDaysAgo)
        .order('snapshot_date'),
      supabase
        .from('forecast_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .not('area_id', 'is', null)
        .gt('delta_days', AT_RISK_THRESHOLD_DAYS),
      supabase
        .from('schedule_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('is_critical', true),
    ]);

    const snapshots = snapshotResult.data ?? [];

    const trendData: TrendSnapshot[] = snapshots.map((s) => ({
      date: s.snapshot_date,
      effectivePct: Number(s.effective_pct),
      actualRate: s.actual_rate != null ? Number(s.actual_rate) : null,
      benchmarkRate: s.benchmark_rate != null ? Number(s.benchmark_rate) : null,
    }));

    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const scheduledDate = (latest?.scheduled_date as string) ?? null;
    const projectedDate = (latest?.projected_date as string) ?? null;

    let deltaDays: number | null = null;
    if (scheduledDate && projectedDate) {
      const scheduled = new Date(scheduledDate).getTime();
      const projected = new Date(projectedDate).getTime();
      deltaDays = Math.round((projected - scheduled) / MS_PER_DAY);
    }

    return {
      trendData,
      scheduledDate,
      projectedDate,
      deltaDays,
      atRiskCount: atRiskResult.count ?? 0,
      criticalPathItems: criticalResult.count ?? 0,
    };
  } catch {
    return { trendData: [], scheduledDate: null, projectedDate: null, deltaDays: null, atRiskCount: 0, criticalPathItems: 0 };
  }
}

// ─── Schedule Comparison (Section 5) ─────────────────

async function fetchScheduleComparison(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ScheduleComparisonRow[]> {
  try {
    // Get latest snapshot date for area-level rows
    const { data: latestRow } = await supabase
      .from('forecast_snapshots')
      .select('snapshot_date')
      .eq('project_id', projectId)
      .not('area_id', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow) return [];

    // Area-level snapshots for latest date, sorted by delta DESC (worst first)
    const { data: snapshots } = await supabase
      .from('forecast_snapshots')
      .select('area_id, trade_type, projected_date, scheduled_date, delta_days')
      .eq('project_id', projectId)
      .eq('snapshot_date', latestRow.snapshot_date)
      .not('area_id', 'is', null)
      .order('delta_days', { ascending: false })
      .limit(10);

    if (!snapshots?.length) return [];

    // Resolve area names + critical path flag from schedule_items
    const areaIds = [...new Set(snapshots.map((s) => s.area_id))];
    const { data: scheduleInfo } = await supabase
      .from('schedule_items')
      .select('area_id, area_name, trade_name, baseline_finish, is_critical')
      .eq('project_id', projectId)
      .in('area_id', areaIds);

    const infoMap = new Map<string, { areaName: string; baselineFinish: string | null; isCritical: boolean }>();
    for (const s of scheduleInfo ?? []) {
      infoMap.set(`${s.area_id}:${s.trade_name}`, {
        areaName: s.area_name,
        baselineFinish: s.baseline_finish,
        isCritical: s.is_critical ?? false,
      });
    }

    return snapshots.map((snap) => {
      const info = infoMap.get(`${snap.area_id}:${snap.trade_type}`);
      return {
        areaName: info?.areaName ?? 'Unknown',
        tradeName: snap.trade_type,
        baselineFinish: info?.baselineFinish ?? snap.scheduled_date,
        projectedDate: snap.projected_date,
        deltaDays: snap.delta_days,
        isCritical: info?.isCritical ?? false,
      };
    });
  } catch {
    return [];
  }
}
