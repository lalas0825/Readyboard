'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { upsertScheduleBaselines, type BaselineInput } from '../services/upsertScheduleBaselines';
import type { ScheduleBaselineRow } from '../services/fetchScheduleBaselines';
import type { FloorTradeCell } from '../services/fetchFloorTradeMatrix';

// ─── Types ───────────────────────────────────────────

type Props = {
  projectId: string;
  /** All unique floor × trade combinations from area_trade_status */
  matrix: FloorTradeCell[];
  /** Existing saved baselines from schedule_baselines */
  baselines: ScheduleBaselineRow[];
};

type EditKey = `${string}||${string}`; // `${floor}||${tradeName}`

type EditState = {
  plannedStart: string;
  plannedEnd: string;
};

// ─── Helpers ─────────────────────────────────────────

/** Count work days (Mon–Fri) between two ISO date strings, inclusive */
function workDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Add N work days to an ISO date string */
function addWorkDays(isoDate: string, days: number): string {
  if (!isoDate || days <= 0) return isoDate;
  const d = new Date(isoDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

const STATUS_BADGE: Record<string, string> = {
  DONE: 'bg-blue-900/30 text-blue-400',
  IN_PROGRESS: 'bg-indigo-900/30 text-indigo-400',
  PENDING_GC: 'bg-purple-900/30 text-purple-400',
  PENDING: 'bg-zinc-800 text-zinc-500',
};

const STATUS_LABEL: Record<string, string> = {
  DONE: 'Done',
  IN_PROGRESS: 'Working',
  PENDING_GC: 'GC Verify',
  PENDING: 'Pending',
};

// ─── Component ──────────────────────────────────────

export function ManualEntryTab({ projectId, matrix, baselines }: Props) {
  const [saving, setSaving] = useState(false);
  const [offsetDays, setOffsetDays] = useState(2);
  const [dirty, setDirty] = useState(false);

  // Build initial edit state from existing baselines
  const [edits, setEdits] = useState<Map<EditKey, EditState>>(() => {
    const m = new Map<EditKey, EditState>();
    for (const b of baselines) {
      const key: EditKey = `${b.floor}||${b.tradeName}`;
      m.set(key, {
        plannedStart: b.plannedStart ?? '',
        plannedEnd: b.plannedEnd ?? '',
      });
    }
    return m;
  });

  // Group matrix by trade
  const byTrade = useMemo(() => {
    const map = new Map<string, FloorTradeCell[]>();
    for (const cell of matrix) {
      const arr = map.get(cell.tradeName) ?? [];
      arr.push(cell);
      map.set(cell.tradeName, arr);
    }
    return map;
  }, [matrix]);

  const allTrades = useMemo(
    () => Array.from(byTrade.keys()).sort(),
    [byTrade],
  );

  const allFloors = useMemo(() => {
    const set = new Set(matrix.map((c) => c.floor));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [matrix]);

  const getEdit = useCallback(
    (floor: string, tradeName: string): EditState => {
      return edits.get(`${floor}||${tradeName}` as EditKey) ?? { plannedStart: '', plannedEnd: '' };
    },
    [edits],
  );

  const setField = useCallback(
    (floor: string, tradeName: string, field: 'plannedStart' | 'plannedEnd', value: string) => {
      setEdits((prev) => {
        const next = new Map(prev);
        const key: EditKey = `${floor}||${tradeName}`;
        const cur = next.get(key) ?? { plannedStart: '', plannedEnd: '' };
        next.set(key, { ...cur, [field]: value });
        return next;
      });
      setDirty(true);
    },
    [],
  );

  // Apply first floor's dates to all floors, offset by N work days each
  const applyToAll = useCallback(
    (tradeName: string) => {
      const floors = byTrade.get(tradeName);
      if (!floors || floors.length < 2) return;

      // Sorted floors
      const sortedFloors = floors
        .map((c) => c.floor)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const firstFloor = sortedFloors[0];
      const baseEdit = edits.get(`${firstFloor}||${tradeName}` as EditKey);
      if (!baseEdit?.plannedStart && !baseEdit?.plannedEnd) {
        toast.error('Fill in dates for the first floor first.');
        return;
      }

      setEdits((prev) => {
        const next = new Map(prev);
        sortedFloors.forEach((floor, idx) => {
          if (idx === 0) return; // skip first floor (already filled)
          const offset = idx * offsetDays;
          const start = baseEdit.plannedStart
            ? addWorkDays(baseEdit.plannedStart, offset)
            : '';
          const end = baseEdit.plannedEnd
            ? addWorkDays(baseEdit.plannedEnd, offset)
            : '';
          next.set(`${floor}||${tradeName}` as EditKey, { plannedStart: start, plannedEnd: end });
        });
        return next;
      });
      setDirty(true);
      toast.success(`Applied dates to all ${sortedFloors.length} floors for ${tradeName}.`);
    },
    [byTrade, edits, offsetDays],
  );

  const handleSave = async () => {
    setSaving(true);
    const rows: BaselineInput[] = [];
    for (const [key, state] of edits.entries()) {
      const [floor, tradeName] = key.split('||');
      rows.push({
        floor,
        tradeName,
        plannedStart: state.plannedStart || null,
        plannedEnd: state.plannedEnd || null,
      });
    }

    const res = await upsertScheduleBaselines(projectId, rows);
    setSaving(false);
    if (res.success) {
      toast.success('Schedule baselines saved.');
      setDirty(false);
    } else {
      toast.error(res.error ?? 'Save failed.');
    }
  };

  if (matrix.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-sm text-zinc-500">
          No floor × trade combinations found. Add areas to your project first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Controls ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Floor offset:</span>
          <input
            type="number"
            min={1}
            max={30}
            value={offsetDays}
            onChange={(e) => setOffsetDays(Math.max(1, Number(e.target.value)))}
            className="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
          />
          <span className="text-xs text-zinc-500">work days / floor</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Baselines'}
        </button>
      </div>

      {/* ─── Trade Groups ──────────────────────────── */}
      <div className="space-y-3">
        {allTrades.map((tradeName) => {
          const cells = byTrade.get(tradeName) ?? [];
          const sortedCells = [...cells].sort((a, b) =>
            a.floor.localeCompare(b.floor, undefined, { numeric: true }),
          );

          return (
            <div key={tradeName} className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              {/* Trade header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
                <p className="text-xs font-medium text-zinc-300">{tradeName}</p>
                <button
                  onClick={() => applyToAll(tradeName)}
                  disabled={sortedCells.length < 2}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-amber-600/50 hover:text-amber-400 disabled:opacity-30"
                  title="Apply first floor dates to all floors, offset by N work days"
                >
                  Apply to all floors →
                </button>
              </div>

              {/* Rows table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800/50 text-zinc-500">
                      <th className="px-3 py-1.5 font-medium">Floor</th>
                      <th className="px-3 py-1.5 font-medium">Planned Start</th>
                      <th className="px-3 py-1.5 font-medium">Planned End</th>
                      <th className="px-3 py-1.5 text-right font-medium">Duration</th>
                      <th className="px-3 py-1.5 font-medium">Status</th>
                      <th className="px-3 py-1.5 font-medium">Actual Start</th>
                      <th className="px-3 py-1.5 font-medium">Actual End</th>
                      <th className="px-3 py-1.5 text-right font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {sortedCells.map((cell) => {
                      const edit = getEdit(cell.floor, tradeName);
                      const duration = workDays(edit.plannedStart, edit.plannedEnd);

                      // Delta: compare actual start vs planned start (work days)
                      let delta: number | null = null;
                      if (cell.actualStart && edit.plannedStart) {
                        delta = workDays(edit.plannedStart, cell.actualStart) - 1;
                        if (new Date(cell.actualStart) < new Date(edit.plannedStart)) {
                          delta = -workDays(cell.actualStart, edit.plannedStart) + 1;
                        }
                      }

                      const statusKey = cell.status ?? 'PENDING';
                      const statusBadge = STATUS_BADGE[statusKey] ?? STATUS_BADGE.PENDING;
                      const statusLabel = STATUS_LABEL[statusKey] ?? statusKey;

                      return (
                        <tr key={cell.floor} className="hover:bg-zinc-800/30">
                          <td className="px-3 py-1.5 font-medium text-zinc-200">
                            Floor {cell.floor}
                          </td>

                          {/* Planned Start */}
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              value={edit.plannedStart}
                              onChange={(e) => setField(cell.floor, tradeName, 'plannedStart', e.target.value)}
                              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                            />
                          </td>

                          {/* Planned End */}
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              value={edit.plannedEnd}
                              onChange={(e) => setField(cell.floor, tradeName, 'plannedEnd', e.target.value)}
                              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                            />
                          </td>

                          {/* Duration (auto) */}
                          <td className="px-3 py-1.5 text-right text-zinc-400">
                            {duration > 0 ? `${duration}d` : '—'}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge}`}>
                              {statusLabel}
                            </span>
                          </td>

                          {/* Actual Start */}
                          <td className="px-3 py-1.5 text-zinc-400">
                            {cell.actualStart
                              ? new Date(cell.actualStart).toLocaleDateString()
                              : '—'}
                          </td>

                          {/* Actual End */}
                          <td className="px-3 py-1.5 text-zinc-400">
                            {cell.actualEnd
                              ? new Date(cell.actualEnd).toLocaleDateString()
                              : '—'}
                          </td>

                          {/* Delta */}
                          <td className="px-3 py-1.5 text-right">
                            {delta === null ? (
                              <span className="text-zinc-600">—</span>
                            ) : delta === 0 ? (
                              <span className="text-green-400">On time</span>
                            ) : delta > 0 ? (
                              <span className="text-red-400">+{delta}d late</span>
                            ) : (
                              <span className="text-green-400">{delta}d early</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Floor summary ─────────────────────────── */}
      <p className="text-center text-[10px] text-zinc-600">
        {allFloors.length} floors × {allTrades.length} trades = {matrix.length} cells
        {dirty ? ' · Unsaved changes' : ''}
      </p>
    </div>
  );
}
