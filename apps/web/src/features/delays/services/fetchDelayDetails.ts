'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { MS_PER_HOUR } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────

export type DelayLegalStatus = 'pending' | 'draft' | 'sent' | 'signed' | null;

export type DelayRow = {
  id: string;
  areaId: string;
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  crewSize: number;
  startedAt: string;
  endedAt: string | null;
  durationHours: number;
  manHours: number;
  dailyCost: number;
  cumulativeCost: number;
  isActive: boolean;
  legalStatus: DelayLegalStatus;
  gpsLat: number | null;
  gpsLng: number | null;
  photoUrl: string | null;
  hasFieldReport: boolean;
};

export type DelayPageData = {
  delays: DelayRow[];
  totals: {
    activeCount: number;
    closedCount: number;
    totalManHours: number;
    totalDailyCost: number;
    totalCumulativeCost: number;
  };
  laborRate: number;
  trades: string[];
  projectId: string;
};

// ─── Fetch ──────────────────────────────────────────

/**
 * Fetches delay logs with GPS/photo data from related field_reports.
 * Extends delayEngine's getDelayLogSummary with evidence columns.
 */
export async function fetchDelayDetails(
  projectId?: string,
): Promise<DelayPageData> {
  const session = await getSession();
  if (!session) return emptyData();

  const supabase = session.isDevBypass
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
  if (!pid) return emptyData();

  // Parallel fetch: project info + delay logs + field reports for GPS/photos
  const [projectResult, logsResult, reportsResult] = await Promise.all([
    supabase.from('projects').select('labor_rate_per_hour').eq('id', pid).single(),
    supabase
      .from('delay_logs')
      .select(`
        id, area_id, trade_name, reason_code, crew_size,
        started_at, ended_at, legal_status,
        man_hours, daily_cost, cumulative_cost,
        areas!inner ( name, floor, project_id )
      `)
      .eq('areas.project_id', pid)
      .order('started_at', { ascending: false }),
    supabase
      .from('field_reports')
      .select('area_id, trade_type, gps_lat, gps_lng, photo_url')
      .eq('status', 'blocked')
      .not('gps_lat', 'is', null),
  ]);

  const laborRate = Number(projectResult.data?.labor_rate_per_hour ?? 0);
  const logs = logsResult.data ?? [];

  // Build GPS/photo lookup: area_id:trade_name → { lat, lng, photo }
  const reportMap = new Map<string, { lat: number; lng: number; photo: string | null }>();
  for (const r of reportsResult.data ?? []) {
    const key = `${r.area_id}:${r.trade_type}`;
    if (!reportMap.has(key)) {
      reportMap.set(key, {
        lat: Number(r.gps_lat),
        lng: Number(r.gps_lng),
        photo: r.photo_url,
      });
    }
  }

  const now = Date.now();
  const tradeSet = new Set<string>();

  const delays: DelayRow[] = logs.map((log) => {
    const area = log.areas as unknown as Record<string, unknown>;
    const isActive = !log.ended_at;
    const crewSize = log.crew_size ?? 1;
    const legalStatus = (log.legal_status as DelayLegalStatus) ?? null;
    const isLocked = legalStatus === 'draft' || legalStatus === 'sent' || legalStatus === 'signed';

    let durationHours: number;
    let manHours: number;
    let cumulativeCost: number;

    if (isLocked || !isActive) {
      durationHours = crewSize > 0 ? Number(log.man_hours) / crewSize : 0;
      manHours = Number(log.man_hours);
      cumulativeCost = Number(log.cumulative_cost);
    } else {
      durationHours = (now - new Date(log.started_at).getTime()) / MS_PER_HOUR;
      manHours = Math.round(durationHours * crewSize * 100) / 100;
      cumulativeCost = Math.round(manHours * laborRate * 100) / 100;
    }

    tradeSet.add(log.trade_name);

    const reportKey = `${log.area_id}:${log.trade_name}`;
    const report = reportMap.get(reportKey);

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
      gpsLat: report?.lat ?? null,
      gpsLng: report?.lng ?? null,
      photoUrl: report?.photo ?? null,
      hasFieldReport: !!report,
    };
  });

  const active = delays.filter((d) => d.isActive);
  const closed = delays.filter((d) => !d.isActive);

  return {
    delays,
    totals: {
      activeCount: active.length,
      closedCount: closed.length,
      totalManHours: round2(delays.reduce((s, d) => s + d.manHours, 0)),
      totalDailyCost: round2(active.reduce((s, d) => s + d.dailyCost, 0)),
      totalCumulativeCost: round2(delays.reduce((s, d) => s + d.cumulativeCost, 0)),
    },
    laborRate,
    trades: Array.from(tradeSet).sort(),
    projectId: pid,
  };
}

// ─── Helpers ────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyData(): DelayPageData {
  return {
    delays: [],
    totals: { activeCount: 0, closedCount: 0, totalManHours: 0, totalDailyCost: 0, totalCumulativeCost: 0 },
    laborRate: 0,
    trades: [],
    projectId: '',
  };
}
