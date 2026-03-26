'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { BURN_RATE_WINDOW_DAYS, AT_RISK_THRESHOLD_DAYS, MS_PER_DAY } from '@/lib/constants';
import type { ScheduleComparisonRow } from '../types';

// ─── Types ──────────────────────────────────────────

export type TrendPoint = {
  date: string;
  effectivePct: number;
  actualRate: number | null;
  benchmarkRate: number | null;
};

export type ForecastPageData = {
  projectId: string;
  projectName: string;
  scheduledDate: string | null;
  projectedDate: string | null;
  deltaDays: number | null;
  atRiskCount: number;
  criticalPathItems: number;
  overallPct: number;
  trendData: TrendPoint[];
  scheduleComparison: ScheduleComparisonRow[];
  atRiskAreas: ScheduleComparisonRow[];
};

// ─── Fetch ──────────────────────────────────────────

export async function fetchForecastPage(
  projectId?: string,
): Promise<ForecastPageData> {
  const session = await getSession();
  if (!session) return emptyData();

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Resolve projectId
  let pid = projectId;
  if (!pid) {
    const { data: p } = await supabase.from('projects').select('id, name').limit(1).single();
    pid = p?.id;
    if (!pid) return emptyData();
  }

  const fourteenDaysAgo = new Date(Date.now() - BURN_RATE_WINDOW_DAYS * MS_PER_DAY).toISOString().split('T')[0];

  // Parallel fetches
  const [projectResult, snapshotResult, atRiskResult, criticalResult, comparisonResult] = await Promise.all([
    supabase.from('projects').select('name').eq('id', pid).single(),
    // Project-level snapshots (14 days)
    supabase
      .from('forecast_snapshots')
      .select('snapshot_date, effective_pct, actual_rate, benchmark_rate, projected_date, scheduled_date')
      .eq('project_id', pid)
      .eq('trade_type', 'PROJECT')
      .is('area_id', null)
      .gte('snapshot_date', fourteenDaysAgo)
      .order('snapshot_date'),
    // At-risk count
    supabase
      .from('forecast_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', pid)
      .not('area_id', 'is', null)
      .gt('delta_days', AT_RISK_THRESHOLD_DAYS),
    // Critical path count
    supabase
      .from('schedule_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', pid)
      .eq('is_critical', true),
    // All area-level comparisons (not limited to 10)
    fetchAllScheduleComparison(supabase, pid),
  ]);

  const snapshots = snapshotResult.data ?? [];
  const trendData: TrendPoint[] = snapshots.map((s) => ({
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

  // Overall pct from latest snapshot
  const overallPct = latest ? Number(latest.effective_pct) : 0;

  // Split at-risk vs on-track
  const atRiskAreas = comparisonResult.filter((r) => (r.deltaDays ?? 0) > AT_RISK_THRESHOLD_DAYS);

  return {
    projectId: pid,
    projectName: projectResult.data?.name ?? '',
    scheduledDate,
    projectedDate,
    deltaDays,
    atRiskCount: atRiskResult.count ?? 0,
    criticalPathItems: criticalResult.count ?? 0,
    overallPct,
    trendData,
    scheduleComparison: comparisonResult,
    atRiskAreas,
  };
}

// ─── Helpers ────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function fetchAllScheduleComparison(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ScheduleComparisonRow[]> {
  try {
    const { data: latestRow } = await supabase
      .from('forecast_snapshots')
      .select('snapshot_date')
      .eq('project_id', projectId)
      .not('area_id', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow) return [];

    const { data: snapshots } = await supabase
      .from('forecast_snapshots')
      .select('area_id, trade_type, projected_date, scheduled_date, delta_days')
      .eq('project_id', projectId)
      .eq('snapshot_date', latestRow.snapshot_date)
      .not('area_id', 'is', null)
      .order('delta_days', { ascending: false });

    if (!snapshots?.length) return [];

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

function emptyData(): ForecastPageData {
  return {
    projectId: '',
    projectName: '',
    scheduledDate: null,
    projectedDate: null,
    deltaDays: null,
    atRiskCount: 0,
    criticalPathItems: 0,
    overallPct: 0,
    trendData: [],
    scheduleComparison: [],
    atRiskAreas: [],
  };
}
