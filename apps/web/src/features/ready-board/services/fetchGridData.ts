'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { RawCellData, DelayData, CorrectiveActionData, ReadyBoardInitialData, UnitData } from '../types';
import { deriveActionStatus } from '../lib/deriveActionStatus';

/**
 * Server action: fetches the complete Ready Board grid data.
 * Uses user-scoped client (RLS enforced) when authenticated.
 * Falls back to service_role in dev bypass mode.
 */
export async function fetchGridData(
  projectId?: string,
): Promise<ReadyBoardInitialData> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  // If no projectId, use the first project (dev convenience)
  let pid = projectId;
  let safetyGateEnabled = false;
  if (!pid) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, safety_gate_enabled')
      .limit(1)
      .single();
    pid = project?.id;
    safetyGateEnabled = project?.safety_gate_enabled ?? false;
  } else {
    const { data: project } = await supabase
      .from('projects')
      .select('safety_gate_enabled')
      .eq('id', pid)
      .single();
    safetyGateEnabled = project?.safety_gate_enabled ?? false;
  }

  if (!pid) {
    return { rawCells: [], delays: [], trades: [], projectId: '', actions: [], safetyGateEnabled: false, units: [] };
  }

  // Run grid, trade sequence, active delays, and units queries in parallel.
  // Grid uses a pagination loop (internally sequential) but runs concurrently with the others.
  const PAGE_SIZE = 1000;

  async function fetchAllGridRows() {
    let rows: Record<string, unknown>[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: page, error } = await supabase
        .from('area_trade_status')
        .select(`
          area_id,
          trade_type,
          effective_pct,
          all_gates_passed,
          gc_verification_pending,
          areas!inner (
            name,
            floor,
            area_type,
            project_id,
            unit_id,
            area_code,
            description,
            sort_order,
            units (
              id,
              name,
              unit_type,
              sort_order
            )
          )
        `)
        .eq('areas.project_id', pid)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return { rows: null, error };
      rows = rows.concat(page ?? []);
      hasMore = (page?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return { rows, error: null };
  }

  const [gridResult, seqResult, delayResult, unitResult] = await Promise.all([
    fetchAllGridRows(),
    supabase
      .from('trade_sequences')
      .select('trade_name, phase_label, sequence_order')
      .eq('project_id', pid)
      .order('sequence_order'),
    supabase
      .from('delay_logs')
      .select('id, area_id, trade_name, reason_code, cumulative_cost, daily_cost, man_hours, crew_size, started_at, areas!inner(project_id)')
      .eq('areas.project_id', pid)
      .is('ended_at', null),
    supabase
      .from('units')
      .select('id, name, floor, unit_type, sort_order')
      .eq('project_id', pid)
      .order('floor')
      .order('sort_order'),
  ]);

  if (gridResult.error) {
    console.error('[ReadyBoard] Grid query failed:', gridResult.error);
    return { rawCells: [], delays: [], trades: [], projectId: pid, actions: [], safetyGateEnabled: false, units: [] };
  }

  const rawRows = gridResult.rows ?? [];

  // Trade sequence order — phase-aware. Column keys are composite: "{trade_name}::{phase_label}"
  // when a phase is present, otherwise just the plain trade_name. Matches area_trade_status.trade_type.
  const seqMap = new Map<string, number>();
  const trades: string[] = [];
  for (const s of seqResult.data ?? []) {
    const key = s.phase_label ? `${s.trade_name}::${s.phase_label}` : s.trade_name;
    if (!seqMap.has(key)) {
      seqMap.set(key, s.sequence_order);
      trades.push(key);
    }
  }

  // Active delays (ended_at IS NULL) — already fetched in parallel above
  const delayRows = delayResult.data;

  // Transform raw rows
  const rawCells: RawCellData[] = (rawRows ?? []).map((row: Record<string, unknown>) => {
    const areas = row.areas as Record<string, unknown>;
    const unit = areas.units as Record<string, unknown> | null;
    return {
      area_id: row.area_id as string,
      area_name: areas.name as string,
      floor: areas.floor as string,
      trade_type: row.trade_type as string,
      sequence_order: seqMap.get(row.trade_type as string) ?? 99,
      effective_pct: Number(row.effective_pct),
      all_gates_passed: row.all_gates_passed as boolean,
      gc_verification_pending: row.gc_verification_pending as boolean,
      area_type: (areas.area_type as string) ?? '',
      unit_id: (areas.unit_id as string) ?? null,
      unit_name: (unit?.name as string) ?? null,
      unit_type: (unit?.unit_type as string) ?? null,
      area_code: (areas.area_code as string) ?? null,
      area_description: (areas.description as string) ?? null,
      area_sort_order: Number(areas.sort_order ?? 0),
    };
  });

  const delays: DelayData[] = (delayRows ?? []).map((d) => ({
    id: d.id,
    area_id: d.area_id,
    trade_name: d.trade_name,
    reason_code: d.reason_code,
    cumulative_cost: Number(d.cumulative_cost),
    daily_cost: Number(d.daily_cost ?? 0),
    man_hours: Number(d.man_hours ?? 0),
    crew_size: Number(d.crew_size ?? 0),
    started_at: d.started_at,
  }));

  // Corrective actions for active delays
  const activeDelayIds = delays.map((d) => d.id);
  let actions: CorrectiveActionData[] = [];

  if (activeDelayIds.length > 0) {
    const { data: caRows } = await supabase
      .from('corrective_actions')
      .select(`
        id,
        delay_log_id,
        assigned_to,
        deadline,
        note,
        created_by,
        created_at,
        acknowledged_at,
        in_resolution_at,
        resolved_at,
        users!corrective_actions_assigned_to_fkey ( name ),
        delay_logs!inner ( area_id, trade_name )
      `)
      .in('delay_log_id', activeDelayIds);

    actions = (caRows ?? []).map((row: Record<string, unknown>) => {
      const dl = row.delay_logs as Record<string, unknown>;
      const u = row.users as Record<string, unknown>;
      return {
        id: row.id as string,
        delay_log_id: row.delay_log_id as string,
        area_id: dl.area_id as string,
        trade_name: dl.trade_name as string,
        assigned_to: row.assigned_to as string,
        assigned_to_name: (u?.name as string) ?? 'Unknown',
        deadline: row.deadline as string,
        note: row.note as string | null,
        created_by: row.created_by as string,
        created_at: row.created_at as string,
        status: deriveActionStatus({
          resolved_at: row.resolved_at as string | null,
          in_resolution_at: row.in_resolution_at as string | null,
          acknowledged_at: row.acknowledged_at as string | null,
        }),
      };
    });
  }

  // Units already fetched in parallel above
  const units: UnitData[] = (unitResult.data ?? []).map((u) => ({
    id: u.id as string,
    name: u.name as string,
    floor: u.floor as string,
    unit_type: (u.unit_type as string) ?? null,
    sort_order: Number(u.sort_order ?? 0),
  }));

  return { rawCells, delays, trades, projectId: pid, actions, safetyGateEnabled, units };
}
