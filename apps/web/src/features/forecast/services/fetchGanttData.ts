'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Types ─────────────────────────────────────────

export type GanttRow = {
  id: string;
  floor: string;
  tradeName: string;
  sequenceOrder: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  /** work-day delta: positive = behind, negative = ahead */
  delta: number | null;
};

export type GanttDependency = {
  fromId: string;
  toId: string;
  isCritical: boolean;
};

export type GanttData = {
  rows: GanttRow[];
  dependencies: GanttDependency[];
  tradeOrder: string[];
};

// ─── Helpers ───────────────────────────────────────

function workDaysBetween(a: string, b: string): number {
  let count = 0;
  const d = new Date(a);
  const end = new Date(b);
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ─── Fetch ─────────────────────────────────────────

export async function fetchGanttData(projectId: string): Promise<GanttData> {
  const session = await getSession();
  if (!session) return { rows: [], dependencies: [], tradeOrder: [] };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const [baselinesRes, scheduleItemsRes, actualsRes, tradesRes] = await Promise.all([
    supabase
      .from('schedule_baselines')
      .select('id, trade_name, floor, planned_start, planned_end')
      .eq('project_id', projectId)
      .order('planned_start'),
    // Also fetch CSV-imported schedule_items — include ALL rows (area_id may be NULL)
    supabase
      .from('schedule_items')
      .select('id, trade_name, area_name, planned_start, planned_finish, area_id, areas(floor)')
      .eq('project_id', projectId),
    supabase
      .from('area_trade_status')
      .select(
        'trade_type, effective_pct, started_at, completed_at, areas!inner(floor, project_id)',
      )
      .eq('areas.project_id', projectId),
    supabase
      .from('trade_sequences')
      .select('trade_name, sequence_order')
      .eq('project_id', projectId)
      .order('sequence_order'),
  ]);

  const manualBaselines = baselinesRes.data ?? [];
  const csvItems = scheduleItemsRes.data ?? [];
  const actuals = actualsRes.data ?? [];
  const trades = tradesRes.data ?? [];

  // Merge sources: manual baselines take priority, CSV items fill gaps.
  // Aggregate CSV items per floor × trade (multiple areas per floor×trade → use min start, max end)
  type BaselineEntry = { id: string; trade_name: string; floor: string; planned_start: string | null; planned_end: string | null };
  const baselineMap = new Map<string, BaselineEntry>();

  // Add manual baselines first (priority)
  for (const b of manualBaselines) {
    const key = `${b.floor}||${b.trade_name}`;
    baselineMap.set(key, {
      id: b.id as string,
      trade_name: b.trade_name as string,
      floor: b.floor as string,
      planned_start: (b.planned_start as string) ?? null,
      planned_end: (b.planned_end as string) ?? null,
    });
  }

  // Fill from CSV schedule_items (only if no manual baseline exists for that floor×trade)
  for (const item of csvItems) {
    // Try to get floor from joined area first, fall back to parsing area_name
    const areaData = item.areas as unknown as { floor: string } | null;
    let floor = areaData?.floor ?? null;
    if (!floor) {
      // Parse floor from area_name pattern: "Trade Name - Floor N"
      const areaName = (item.area_name as string) ?? '';
      const floorMatch = areaName.match(/Floor\s+(\S+)/i);
      if (floorMatch) floor = floorMatch[1];
    }
    if (!floor) continue;
    const tradeName = item.trade_name as string;
    const key = `${floor}||${tradeName}`;

    if (baselineMap.has(key)) continue; // manual takes priority

    const existing = baselineMap.get(key);
    const start = (item.planned_start as string) ?? null;
    const end = (item.planned_finish as string) ?? null;

    if (!existing) {
      baselineMap.set(key, {
        id: item.id as string,
        trade_name: tradeName,
        floor,
        planned_start: start,
        planned_end: end,
      });
    } else {
      // Merge: earliest start, latest end
      if (start && (!existing.planned_start || start < existing.planned_start)) {
        existing.planned_start = start;
      }
      if (end && (!existing.planned_end || end > existing.planned_end)) {
        existing.planned_end = end;
      }
    }
  }

  const baselines = Array.from(baselineMap.values());

  const tradeOrder = trades.map((t) => t.trade_name as string);
  const seqMap = new Map(trades.map((t) => [t.trade_name as string, t.sequence_order as number]));

  // Aggregate actuals per floor × trade
  const actualMap = new Map<
    string,
    { minStart: string | null; maxEnd: string | null; avgPct: number; count: number; sumPct: number }
  >();

  for (const row of actuals) {
    const areas = row.areas as unknown as { floor: string };
    const key = `${areas.floor}||${row.trade_type}`;
    const existing = actualMap.get(key);
    const pct = (row.effective_pct as number) ?? 0;
    const start = row.started_at as string | null;
    const end = row.completed_at as string | null;

    if (!existing) {
      actualMap.set(key, {
        minStart: start,
        maxEnd: end,
        avgPct: pct,
        count: 1,
        sumPct: pct,
      });
    } else {
      existing.count++;
      existing.sumPct += pct;
      existing.avgPct = existing.sumPct / existing.count;
      if (start && (!existing.minStart || start < existing.minStart)) existing.minStart = start;
      if (!end) {
        existing.maxEnd = null;
      } else if (existing.maxEnd && end > existing.maxEnd) {
        existing.maxEnd = end;
      }
    }
  }

  // Build rows from baselines, merge in actuals
  const rows: GanttRow[] = baselines.map((b) => {
    const key = `${b.floor}||${b.trade_name}`;
    const actual = actualMap.get(key);

    let delta: number | null = null;
    if (b.planned_end && actual?.minStart) {
      const actualEndDate = actual.maxEnd ?? new Date().toISOString().slice(0, 10);
      const plannedEndDate = b.planned_end as string;
      if (actualEndDate > plannedEndDate) {
        delta = workDaysBetween(plannedEndDate, actualEndDate);
      } else if (actualEndDate < plannedEndDate) {
        delta = -workDaysBetween(actualEndDate, plannedEndDate);
      } else {
        delta = 0;
      }
    }

    return {
      id: b.id as string,
      floor: b.floor as string,
      tradeName: b.trade_name as string,
      sequenceOrder: seqMap.get(b.trade_name as string) ?? 99,
      plannedStart: (b.planned_start as string) ?? null,
      plannedEnd: (b.planned_end as string) ?? null,
      actualStart: actual?.minStart ?? null,
      actualEnd: actual?.maxEnd ?? null,
      progress: Math.round(actual?.avgPct ?? 0),
      delta,
    };
  });

  // Infer dependencies: within each floor, trade N depends on trade N-1
  const byFloor = new Map<string, GanttRow[]>();
  for (const row of rows) {
    const arr = byFloor.get(row.floor) ?? [];
    arr.push(row);
    byFloor.set(row.floor, arr);
  }

  const dependencies: GanttDependency[] = [];
  for (const floorRows of byFloor.values()) {
    const sorted = [...floorRows].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1];
      const to = sorted[i];
      // Zero float = critical
      let isCritical = false;
      if (from.plannedEnd && to.plannedStart) {
        const float = workDaysBetween(from.plannedEnd, to.plannedStart);
        isCritical = float <= 1;
      }
      dependencies.push({ fromId: from.id, toId: to.id, isCritical });
    }
  }

  return { rows, dependencies, tradeOrder };
}
