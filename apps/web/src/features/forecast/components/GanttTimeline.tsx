'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import type { GanttRow, GanttDependency } from '../services/fetchGanttData';

// ─── Types ─────────────────────────────────────────

type Props = {
  rows: GanttRow[];
  dependencies: GanttDependency[];
  tradeOrder: string[];
  initialFloor?: string | null;
};

type GroupBy = 'floor' | 'trade';

type Group = {
  key: string;
  label: string;
  items: GanttRow[];
};

type TooltipData = {
  row: GanttRow;
  x: number;
  y: number;
};

// ─── Date Helpers ──────────────────────────────────

function daysBetween(a: Date | string, b: Date | string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getMonthsBetween(start: Date, end: Date): { label: string; days: number; start: Date }[] {
  const months: { label: string; days: number; start: Date }[] = [];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const effectiveStart = cur < start ? start : cur;
    const effectiveEnd = monthEnd > end ? end : monthEnd;
    const days = daysBetween(effectiveStart, effectiveEnd) + 1;
    months.push({ label: `${labels[cur.getMonth()]} ${cur.getFullYear()}`, days, start: new Date(effectiveStart) });
    cur.setMonth(cur.getMonth() + 1);
    cur.setDate(1);
  }
  return months;
}

// ─── Constants ─────────────────────────────────────

const ROW_HEIGHT = 28; // px per row
const HEADER_HEIGHT = 32; // px for floor/trade group header
const DATE_HEADER_HEIGHT = 40; // px for month+week header
const LABEL_WIDTH = 208; // px for left label column

// ─── Component ─────────────────────────────────────

export function GanttTimeline({ rows, dependencies, tradeOrder, initialFloor }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('floor');
  const [showActual, setShowActual] = useState(true);
  const [showCritical, setShowCritical] = useState(true);
  const [pxPerDay, setPxPerDay] = useState(12);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Group Data ────────────────────────────────

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, GanttRow[]>();
    for (const row of rows) {
      const key = groupBy === 'floor' ? row.floor : row.tradeName;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    const result: Group[] = [];
    for (const [key, items] of map.entries()) {
      const sorted =
        groupBy === 'floor'
          ? [...items].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          : [...items].sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
      result.push({
        key,
        label: groupBy === 'floor' ? `Floor ${key}` : key,
        items: sorted,
      });
    }
    return result.sort((a, b) =>
      groupBy === 'floor'
        ? a.key.localeCompare(b.key, undefined, { numeric: true })
        : (tradeOrder.indexOf(a.key) ?? 99) - (tradeOrder.indexOf(b.key) ?? 99),
    );
  }, [rows, groupBy, tradeOrder]);

  // ─── Date Range ────────────────────────────────

  const { minDate, maxDate, totalDays } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      if (r.plannedStart) min = Math.min(min, new Date(r.plannedStart).getTime());
      if (r.plannedEnd) max = Math.max(max, new Date(r.plannedEnd).getTime());
      if (r.actualStart) min = Math.min(min, new Date(r.actualStart).getTime());
      if (r.actualEnd) max = Math.max(max, new Date(r.actualEnd).getTime());
    }
    if (min === Infinity) min = Date.now();
    if (max === -Infinity) max = Date.now();
    // Add 14 day buffers
    const minD = new Date(min - 14 * 86400000);
    const maxD = new Date(max + 30 * 86400000);
    return { minDate: minD, maxDate: maxD, totalDays: daysBetween(minD, maxD) };
  }, [rows]);

  const totalWidth = totalDays * pxPerDay;
  const today = new Date();
  const todayOffset = daysBetween(minDate, today) * pxPerDay;

  // ─── Row Y positions ──────────────────────────

  const { rowPositions, totalHeight } = useMemo(() => {
    const pos = new Map<string, number>(); // row.id → y offset
    let y = 0;
    for (const group of groups) {
      y += HEADER_HEIGHT; // group header
      if (!collapsed.has(group.key)) {
        for (const item of group.items) {
          pos.set(item.id, y);
          y += ROW_HEIGHT;
        }
      }
    }
    return { rowPositions: pos, totalHeight: y };
  }, [groups, collapsed]);

  // ─── Months ────────────────────────────────────

  const months = useMemo(() => getMonthsBetween(minDate, maxDate), [minDate, maxDate]);

  // ─── Controls ──────────────────────────────────

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const fitAll = useCallback(() => {
    if (!scrollRef.current) return;
    const viewWidth = scrollRef.current.clientWidth - LABEL_WIDTH;
    if (totalDays > 0 && viewWidth > 0) {
      setPxPerDay(Math.max(4, Math.min(30, Math.floor(viewWidth / totalDays))));
    }
  }, [totalDays]);

  // ─── Bar position helper ───────────────────────

  const barStyle = useCallback(
    (start: string | null, end: string | null) => {
      if (!start) return { left: 0, width: 0, visible: false };
      const endDate = end ?? today.toISOString().slice(0, 10);
      const left = daysBetween(minDate, start) * pxPerDay;
      const width = Math.max(daysBetween(start, endDate) * pxPerDay, 4);
      return { left, width, visible: true };
    },
    [minDate, pxPerDay, today],
  );

  // ─── Bar color ─────────────────────────────────

  const barColor = (delta: number | null) => {
    if (delta === null) return 'bg-blue-500';
    if (delta > 0) return 'bg-red-500';
    if (delta < 0) return 'bg-green-500';
    return 'bg-blue-500';
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-sm text-zinc-500">
          No schedule baselines found. Use the Manual Entry or CSV Import tab to add planned dates first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── Controls ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
        >
          <option value="floor">Group by Floor</option>
          <option value="trade">Group by Trade</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showActual}
            onChange={(e) => setShowActual(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Show actual
        </label>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showCritical}
            onChange={(e) => setShowCritical(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Critical path
        </label>

        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setPxPerDay((p) => Math.max(4, p - 2))}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            −
          </button>
          <button
            onClick={() => setPxPerDay((p) => Math.min(30, p + 2))}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            +
          </button>
          <button
            onClick={fitAll}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            Fit
          </button>
        </div>
      </div>

      {/* ─── Chart ─────────────────────────────── */}
      <div
        ref={scrollRef}
        className="relative rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <div className="flex">
          {/* ─── LEFT: Labels ──────────────── */}
          <div
            className="flex-shrink-0 border-r border-zinc-700/50 bg-zinc-900 z-10"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Date header spacer */}
            <div
              className="border-b border-zinc-700/50"
              style={{ height: DATE_HEADER_HEIGHT }}
            />

            {/* Group labels */}
            {groups.map((group) => (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="flex h-8 w-full items-center gap-1.5 bg-zinc-800/50 px-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  <span className="text-zinc-500">
                    {collapsed.has(group.key) ? '▶' : '▼'}
                  </span>
                  {group.label}
                  <span className="ml-auto text-[10px] text-zinc-600">
                    {group.items.length}
                  </span>
                </button>

                {/* Row labels */}
                {!collapsed.has(group.key) &&
                  group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center truncate px-3 text-xs text-zinc-400"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {groupBy === 'floor' ? item.tradeName : `Floor ${item.floor}`}
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {/* ─── RIGHT: Bars (scrollable) ──── */}
          <div className="flex-1 overflow-x-auto">
            {/* Date header */}
            <div
              className="sticky top-0 z-20 border-b border-zinc-700/50 bg-zinc-900/95"
              style={{ height: DATE_HEADER_HEIGHT, width: totalWidth }}
            >
              {/* Month row */}
              <div className="flex h-6">
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center border-r border-zinc-800/50 px-1 text-[10px] text-zinc-500"
                    style={{ width: m.days * pxPerDay }}
                  >
                    {m.days * pxPerDay > 40 ? m.label : ''}
                  </div>
                ))}
              </div>
              {/* Week ticks */}
              <div className="flex h-[16px]">
                {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                  <div
                    key={i}
                    className="border-r border-zinc-800/30"
                    style={{ width: 7 * pxPerDay }}
                  />
                ))}
              </div>
            </div>

            {/* Bar area */}
            <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
              {/* Today line */}
              {todayOffset > 0 && todayOffset < totalWidth && (
                <div
                  className="absolute top-0 bottom-0 z-10 w-px bg-red-500/70"
                  style={{ left: todayOffset }}
                />
              )}

              {/* Week gridlines */}
              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-zinc-800/20"
                  style={{ left: (i + 1) * 7 * pxPerDay }}
                />
              ))}

              {/* Groups + Bars */}
              {groups.map((group) => {
                const firstItemY = rowPositions.get(group.items[0]?.id ?? '');
                const headerY = firstItemY != null ? firstItemY - HEADER_HEIGHT : 0;

                return (
                  <div key={group.key}>
                    {/* Group header spacer */}
                    <div
                      className="absolute left-0 right-0 bg-zinc-800/30"
                      style={{ top: headerY, height: HEADER_HEIGHT }}
                    />

                    {/* Bars */}
                    {!collapsed.has(group.key) &&
                      group.items.map((item) => {
                        const y = rowPositions.get(item.id) ?? 0;
                        const planned = barStyle(item.plannedStart, item.plannedEnd);
                        const actual = barStyle(item.actualStart, item.actualEnd);

                        return (
                          <div
                            key={item.id}
                            className="absolute left-0 right-0"
                            style={{ top: y, height: ROW_HEIGHT }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({
                                row: item,
                                x: e.clientX - rect.left + 10,
                                y: 0,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {/* Planned bar (gray, top) */}
                            {planned.visible && (
                              <div
                                className="absolute top-1 h-2.5 rounded-sm bg-white/15"
                                style={{ left: planned.left, width: planned.width }}
                              />
                            )}

                            {/* Actual bar (colored, bottom) */}
                            {showActual && actual.visible && (
                              <div
                                className={`absolute top-[14px] h-2.5 rounded-sm ${barColor(item.delta)}`}
                                style={{ left: actual.left, width: actual.width }}
                              >
                                {/* Progress overlay */}
                                {item.progress > 0 && item.progress < 100 && (
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-sm bg-white/20"
                                    style={{ width: `${item.progress}%` }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}

              {/* ─── Dependency Arrows (SVG) ───── */}
              {showCritical && dependencies.length > 0 && (
                <svg
                  className="pointer-events-none absolute inset-0"
                  style={{ width: totalWidth, height: totalHeight }}
                >
                  <defs>
                    <marker
                      id="arrow-gray"
                      markerWidth="6"
                      markerHeight="4"
                      refX="6"
                      refY="2"
                      orient="auto"
                    >
                      <polygon points="0 0, 6 2, 0 4" fill="#4b5563" fillOpacity="0.4" />
                    </marker>
                    <marker
                      id="arrow-red"
                      markerWidth="6"
                      markerHeight="4"
                      refX="6"
                      refY="2"
                      orient="auto"
                    >
                      <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
                    </marker>
                  </defs>
                  {dependencies.map((dep) => {
                    const fromY = rowPositions.get(dep.fromId);
                    const toY = rowPositions.get(dep.toId);
                    if (fromY == null || toY == null) return null;

                    const fromRow = rows.find((r) => r.id === dep.fromId);
                    const toRow = rows.find((r) => r.id === dep.toId);
                    if (!fromRow?.plannedEnd || !toRow?.plannedStart) return null;

                    const fromX = daysBetween(minDate, fromRow.plannedEnd) * pxPerDay;
                    const toX = daysBetween(minDate, toRow.plannedStart) * pxPerDay;
                    const fY = fromY + ROW_HEIGHT / 2;
                    const tY = toY + ROW_HEIGHT / 2;
                    const midX = fromX + (toX - fromX) * 0.5;

                    return (
                      <path
                        key={`${dep.fromId}-${dep.toId}`}
                        d={`M ${fromX} ${fY} H ${midX} V ${tY} H ${toX}`}
                        fill="none"
                        stroke={dep.isCritical ? '#ef4444' : '#4b556344'}
                        strokeWidth={dep.isCritical ? 1.5 : 1}
                        strokeDasharray={dep.isCritical ? undefined : '4 2'}
                        markerEnd={`url(#${dep.isCritical ? 'arrow-red' : 'arrow-gray'})`}
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* ─── Tooltip ───────────────────────── */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-30 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-xs shadow-xl"
            style={{ left: LABEL_WIDTH + tooltip.x, top: DATE_HEADER_HEIGHT + (rowPositions.get(tooltip.row.id) ?? 0) + ROW_HEIGHT }}
          >
            <div className="font-bold text-white">{tooltip.row.tradeName}</div>
            <div className="text-zinc-500">Floor {tooltip.row.floor}</div>
            <div className="mt-2 space-y-1 text-zinc-300">
              <div>
                Plan: {fmtDate(tooltip.row.plannedStart)} → {fmtDate(tooltip.row.plannedEnd)}
              </div>
              {tooltip.row.actualStart && (
                <div>
                  Actual: {fmtDate(tooltip.row.actualStart)} →{' '}
                  {tooltip.row.actualEnd ? fmtDate(tooltip.row.actualEnd) : 'ongoing'}
                </div>
              )}
              <div>Progress: {tooltip.row.progress}%</div>
              {tooltip.row.delta !== null && (
                <div
                  className={
                    tooltip.row.delta > 0
                      ? 'text-red-400'
                      : tooltip.row.delta < 0
                        ? 'text-green-400'
                        : 'text-zinc-400'
                  }
                >
                  {tooltip.row.delta > 0
                    ? `+${tooltip.row.delta} days behind`
                    : tooltip.row.delta < 0
                      ? `${Math.abs(tooltip.row.delta)} days ahead`
                      : 'On track'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Legend ─────────────────────────────── */}
      <div className="flex flex-wrap gap-4 px-1 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-white/15" /> Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" /> On Track
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-red-500" /> Behind
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-green-500" /> Ahead
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-red-500" /> Today
        </span>
        {showCritical && (
          <span className="flex items-center gap-1 text-red-400">━ Critical Path</span>
        )}
      </div>
    </div>
  );
}
