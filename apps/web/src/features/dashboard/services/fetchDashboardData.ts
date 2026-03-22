'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { DashboardData, ProjectMetrics, DashboardAlert, ProjectForecast, TrendSnapshot } from '../types';

function emptyDashboardData(): DashboardData {
  return {
    metrics: { projectId: '', projectName: '', overallPct: 0, totalAreas: 0, onTrack: 0, attention: 0, actionRequired: 0 },
    alerts: [],
    forecast: { trendData: [], scheduledDate: null, projectedDate: null, deltaDays: null },
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
  const [metrics, alerts, forecast, projectInfo] = await Promise.all([
    fetchMetrics(supabase, pid),
    fetchAlerts(supabase, pid),
    fetchForecast(supabase, pid),
    supabase.from('projects').select('name').eq('id', pid).single(),
  ]);

  return {
    metrics: { ...metrics, projectId: pid, projectName: projectInfo.data?.name ?? '' },
    alerts,
    forecast,
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
        daysBlocked: Math.ceil((Date.now() - new Date(d.started_at).getTime()) / 86_400_000),
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

// ─── Forecast (Section 3) ────────────────────────────

async function fetchForecast(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectForecast> {
  try {
    // Last 14 days of forecast snapshots (project-level)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0];
    const { data: snapshots } = await supabase
      .from('forecast_snapshots')
      .select('snapshot_date, effective_pct, projected_date, scheduled_date')
      .eq('project_id', projectId)
      .gte('snapshot_date', fourteenDaysAgo)
      .order('snapshot_date');

    const trendData: TrendSnapshot[] = (snapshots ?? []).map((s) => ({
      date: s.snapshot_date,
      effectivePct: Number(s.effective_pct),
    }));

    // Latest forecast for delta calculation
    const latest = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const scheduledDate = (latest?.scheduled_date as string) ?? null;
    const projectedDate = (latest?.projected_date as string) ?? null;

    let deltaDays: number | null = null;
    if (scheduledDate && projectedDate) {
      const scheduled = new Date(scheduledDate).getTime();
      const projected = new Date(projectedDate).getTime();
      deltaDays = Math.round((projected - scheduled) / 86_400_000);
    }

    return { trendData, scheduledDate, projectedDate, deltaDays };
  } catch {
    return { trendData: [], scheduledDate: null, projectedDate: null, deltaDays: null };
  }
}
