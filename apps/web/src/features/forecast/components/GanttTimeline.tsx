'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  const [showCritical, setShowCritical] = useState(false);
  const [pxPerDay, setPxPerDay] = useState(12);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  const barColor = (delta: number | null, progress: number) => {
    if (progress >= 100) return 'bg-green-500/60';
    if (delta === null) return 'bg-blue-500';
    if (delta > 0) return 'bg-red-500';
    if (delta < 0) return 'bg-green-500';
    return 'bg-blue-500';
  };

  // ─── Dependency lookup (for hover) ─────────────

  const depsByRow = useMemo(() => {
    const map = new Map<string, typeof dependencies>();
    for (const dep of dependencies) {
      const from = map.get(dep.fromId) ?? [];
      from.push(dep);
      map.set(dep.fromId, from);
      const to = map.get(dep.toId) ?? [];
      to.push(dep);
      map.set(dep.toId, to);
    }
    return map;
  }, [dependencies]);

  // ─── Auto-scroll to today on mount ─────────────

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const todayX = daysBetween(minDate, today) * pxPerDay;
    const viewWidth = scrollAreaRef.current.clientWidth;
    // Position today at ~30% from the left
    const target = Math.max(0, todayX - viewWidth * 0.3);
    scrollAreaRef.current.scrollLeft = target;
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Month boundary lines ──────────────────────

  const monthBoundaries = useMemo(() => {
    const result: number[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const offset = daysBetween(minDate, cur) * pxPerDay;
      if (offset >= 0) result.push(offset);
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate, pxPerDay]);

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
                      className={`flex items-center truncate px-3 text-xs transition-colors ${
                        hoveredRow === item.id
                          ? 'bg-white/[0.04] text-zinc-200'
                          : 'text-zinc-400'
                      }`}
                      style={{ height: ROW_HEIGHT }}
                      onMouseEnter={() => setHoveredRow(item.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {groupBy === 'floor' ? item.tradeName : `Floor ${item.floor}`}
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {/* ─── RIGHT: Bars (scrollable) ──── */}
          <div ref={scrollAreaRef} className="flex-1 overflow-x-auto">
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
              {/* Month boundary lines */}
              {monthBoundaries.map((offset, i) => (
                <div
                  key={`month-${i}`}
                  className="absolute top-0 bottom-0 w-px bg-white/5"
                  style={{ left: offset }}
                />
              ))}

              {/* Week gridlines (subtle) */}
              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                <div
                  key={`week-${i}`}
                  className="absolute top-0 bottom-0 w-px bg-white/[0.02]"
                  style={{ left: (i + 1) * 7 * pxPerDay }}
                />
              ))}

              {/* Today line */}
              {todayOffset > 0 && todayOffset < totalWidth && (
                <>
                  <div
                    className="absolute top-0 bottom-0 z-20 w-0.5 bg-red-500/80"
                    style={{ left: todayOffset }}
                  />
                  <div
                    className="absolute z-30 -translate-x-1/2 rounded bg-zinc-950 px-1 text-[9px] font-bold text-red-400"
                    style={{ left: todayOffset, top: 2 }}
                  >
                    TODAY
                  </div>
                </>
              )}

              {/* Groups + Bars */}
              {groups.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                const firstItemY = rowPositions.get(group.items[0]?.id ?? '');
                // When collapsed there are no item positions — derive header Y by recomputing
                let headerY = 0;
                if (firstItemY != null) {
                  headerY = firstItemY - HEADER_HEIGHT;
                } else {
                  // Count preceding groups' heights when collapsed
                  let y = 0;
                  for (const g of groups) {
                    if (g.key === group.key) break;
                    y += HEADER_HEIGHT;
                    if (!collapsed.has(g.key)) y += g.items.length * ROW_HEIGHT;
                  }
                  headerY = y;
                }

                // Compute group date range for collapsed summary bar
                let earliestStart: string | null = null;
                let latestEnd: string | null = null;
                for (const item of group.items) {
                  const s = item.plannedStart ?? item.actualStart;
                  const e = item.plannedEnd ?? item.actualEnd;
                  if (s && (!earliestStart || s < earliestStart)) earliestStart = s;
                  if (e && (!latestEnd || e > latestEnd)) latestEnd = e;
                }
                const summaryBar = barStyle(earliestStart, latestEnd);

                return (
                  <div key={group.key}>
                    {/* Group header spacer */}
                    <div
                      className="absolute left-0 right-0 bg-zinc-800/30"
                      style={{ top: headerY, height: HEADER_HEIGHT }}
                    />

                    {/* Collapsed summary bar */}
                    {isCollapsed && summaryBar.visible && (
                      <div
                        className="absolute top-2 h-3 rounded border border-white/15 bg-white/10"
                        style={{
                          left: summaryBar.left,
                          width: summaryBar.width,
                          top: headerY + 10,
                        }}
                      />
                    )}

                    {/* Bars */}
                    {!isCollapsed &&
                      group.items.map((item) => {
                        const y = rowPositions.get(item.id) ?? 0;
                        const planned = barStyle(item.plannedStart, item.plannedEnd);
                        const actual = barStyle(item.actualStart, item.actualEnd);
                        const hasActual = actual.visible && (item.actualStart != null);
                        const isRowHovered = hoveredRow === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`absolute left-0 right-0 transition-colors ${
                              isRowHovered ? 'bg-white/[0.04]' : ''
                            }`}
                            style={{ top: y, height: ROW_HEIGHT }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredRow(item.id);
                              setTooltip({
                                row: item,
                                x: e.clientX - rect.left + 10,
                                y: 0,
                              });
                            }}
                            onMouseLeave={() => {
                              setHoveredRow(null);
                              setTooltip(null);
                            }}
                          >
                            {/* Planned bar */}
                            {planned.visible && (
                              <div
                                className={
                                  hasActual && showActual
                                    ? 'absolute top-1 h-2.5 rounded-sm bg-white/10'
                                    : 'absolute top-[9px] h-2.5 rounded-sm border border-white/15 bg-white/5'
                                }
                                style={{ left: planned.left, width: planned.width }}
                              />
                            )}

                            {/* Actual bar (colored, bottom) — only when has actual data */}
                            {showActual && hasActual && (
                              <div
                                className={`absolute top-[14px] h-2.5 rounded-sm ${barColor(item.delta, item.progress)}`}
                                style={{ left: actual.left, width: actual.width }}
                              >
                                {/* Progress overlay */}
                                {item.progress > 0 && item.progress < 100 && (
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-sm bg-white/25"
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
              {(showCritical || hoveredRow) && dependencies.length > 0 && (() => {
                // Determine which deps to draw:
                //  - critical path (red dashed) when showCritical
                //  - immediate predecessors/successors of hoveredRow (blue)
                const criticalDeps = showCritical ? dependencies.filter((d) => d.isCritical) : [];
                const hoverDeps = hoveredRow ? (depsByRow.get(hoveredRow) ?? []) : [];
                const drawn = new Set<string>();

                const buildPath = (dep: typeof dependencies[number]) => {
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
                  return `M ${fromX} ${fY} H ${midX} V ${tY} H ${toX}`;
                };

                return (
                  <svg
                    className="pointer-events-none absolute inset-0"
                    style={{ width: totalWidth, height: totalHeight }}
                  >
                    <defs>
                      <marker
                        id="arrow-red"
                        markerWidth="5"
                        markerHeight="4"
                        refX="5"
                        refY="2"
                        orient="auto"
                      >
                        <polygon points="0 0, 5 2, 0 4" fill="#ef4444" fillOpacity="0.7" />
                      </marker>
                      <marker
                        id="arrow-blue"
                        markerWidth="5"
                        markerHeight="4"
                        refX="5"
                        refY="2"
                        orient="auto"
                      >
                        <polygon points="0 0, 5 2, 0 4" fill="#60a5fa" />
                      </marker>
                    </defs>
                    {/* Critical path (thin red dashed, bg) */}
                    {criticalDeps.map((dep) => {
                      const key = `crit-${dep.fromId}-${dep.toId}`;
                      if (drawn.has(key)) return null;
                      drawn.add(key);
                      const d = buildPath(dep);
                      if (!d) return null;
                      return (
                        <path
                          key={key}
                          d={d}
                          fill="none"
                          stroke="#ef4444"
                          strokeOpacity="0.55"
                          strokeWidth={1}
                          strokeDasharray="4 3"
                          markerEnd="url(#arrow-red)"
                        />
                      );
                    })}
                    {/* Hover deps (blue, on top) */}
                    {hoverDeps.map((dep) => {
                      const key = `hov-${dep.fromId}-${dep.toId}`;
                      if (drawn.has(key)) return null;
                      drawn.add(key);
                      const d = buildPath(dep);
                      if (!d) return null;
                      return (
                        <path
                          key={key}
                          d={d}
                          fill="none"
                          stroke="#60a5fa"
                          strokeOpacity="0.9"
                          strokeWidth={1.5}
                          markerEnd="url(#arrow-blue)"
                        />
                      );
                    })}
                  </svg>
                );
              })()}
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
