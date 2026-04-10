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

  const [baselinesRes, actualsRes, tradesRes] = await Promise.all([
    supabase
      .from('schedule_baselines')
      .select('id, trade_name, floor, planned_start, planned_end')
      .eq('project_id', projectId)
      .order('planned_start'),
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

  const baselines = baselinesRes.data ?? [];
  const actuals = actualsRes.data ?? [];
  const trades = tradesRes.data ?? [];

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
