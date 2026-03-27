'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { MS_PER_DAY } from '@/lib/constants';

/**
 * Collects all project data needed for AI briefing generation.
 * Parallel queries for max performance. Returns structured context.
 */

export type BriefingContext = {
  project: { name: string; overallPct: number };
  delays: { count: number; totalCost: number; topAreas: string[] };
  verifications: { pendingCount: number };
  correctiveActions: { openCount: number; overdueCount: number };
  legal: { pendingNods: number; sentNods: number };
  forecast: { deltaDays: number | null; atRiskCount: number };
  recentReports: number;
};

export async function collectBriefingData(
  projectId: string,
): Promise<BriefingContext> {
  const supabase = createServiceClient();
  const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString();

  const [
    projectResult,
    delaysResult,
    verificationsResult,
    casResult,
    nodsResult,
    forecastResult,
    reportsResult,
  ] = await Promise.all([
    // Project info + overall progress
    supabase.from('projects').select('name').eq('id', projectId).single().then(async ({ data: p }) => {
      const { data: ats } = await supabase
        .from('area_trade_status')
        .select('effective_pct, areas!inner(project_id)')
        .eq('areas.project_id', projectId);
      const rows = ats ?? [];
      const avg = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.effective_pct), 0) / rows.length : 0;
      return { name: p?.name ?? '', overallPct: Math.round(avg * 10) / 10 };
    }),

    // Active delays
    supabase.from('delay_logs')
      .select('cumulative_cost, trade_name, areas!inner(name, project_id)')
      .eq('areas.project_id', projectId)
      .is('ended_at', null)
      .order('cumulative_cost', { ascending: false })
      .limit(5),

    // Pending verifications
    supabase.from('area_trade_status')
      .select('id', { count: 'exact', head: true })
      .eq('gc_verification_pending', true),

    // Open corrective actions
    supabase.from('corrective_actions')
      .select('id, deadline, resolved_at, delay_logs!inner(areas!inner(project_id))')
      .eq('delay_logs.areas.project_id', projectId)
      .is('resolved_at', null),

    // Legal: NOD status
    supabase.from('delay_logs')
      .select('legal_status, areas!inner(project_id)')
      .eq('areas.project_id', projectId)
      .not('legal_status', 'is', null),

    // Forecast delta
    supabase.from('forecast_snapshots')
      .select('delta_days')
      .eq('project_id', projectId)
      .eq('trade_type', 'PROJECT')
      .is('area_id', null)
      .order('snapshot_date', { ascending: false })
      .limit(1),

    // Recent reports (last 24h)
    supabase.from('field_reports')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterday),
  ]);

  const delays = delaysResult.data ?? [];
  const cas = casResult.data ?? [];
  const nods = nodsResult.data ?? [];
  const now = Date.now();

  return {
    project: projectResult,
    delays: {
      count: delays.length,
      totalCost: Math.round(delays.reduce((s, d) => s + Number(d.cumulative_cost), 0)),
      topAreas: delays.slice(0, 3).map((d) => {
        const area = d.areas as unknown as Record<string, unknown>;
        return `${(area.name as string) ?? 'Unknown'} (${d.trade_name})`;
      }),
    },
    verifications: { pendingCount: verificationsResult.count ?? 0 },
    correctiveActions: {
      openCount: cas.length,
      overdueCount: cas.filter((c) => new Date(c.deadline).getTime() < now).length,
    },
    legal: {
      pendingNods: nods.filter((n) => n.legal_status === 'pending' || n.legal_status === 'draft').length,
      sentNods: nods.filter((n) => n.legal_status === 'sent').length,
    },
    forecast: {
      deltaDays: forecastResult.data?.[0]?.delta_days ?? null,
      atRiskCount: 0, // Simplified
    },
    recentReports: reportsResult.count ?? 0,
  };
}
