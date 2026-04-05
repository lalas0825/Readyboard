'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTopBarActions } from '@/components/TopBarActionsProvider';
import { useReadyBoardData } from '../hooks/useReadyBoardData';
import { useActionObserver } from '../hooks/useActionObserver';
import { actionBus } from '../lib/ActionEventBus';
import { toastSubscriber } from '../lib/subscribers/toastSubscriber';
import { createOrchestratorSubscriber } from '../lib/subscribers/orchestratorSubscriber';
import { GridHeader } from './GridHeader';
import { GridRow } from './GridRow';
import { GridLegend } from './GridLegend';
import { GridFilterBar } from './GridFilterBar';
import { GridDetailPanel } from './GridDetailPanel';
import { EfficiencyDashboard } from './EfficiencyDashboard';
import { AddAreasModal } from './AddAreasModal';
import type { ReadyBoardInitialData, GridStatus, GridFloor, GridUnit, GridRow as GridRowType, GridCellData } from '../types';
import { STATUS_CONFIG } from '../types';

type ReadyBoardGridProps = {
  initialData: ReadyBoardInitialData;
};

export function ReadyBoardGrid({ initialData }: ReadyBoardGridProps) {
  const {
    floors,
    trades,
    selectedCell,
    isLoading,
    error,
    projectId,
    actionMap,
    selectCell,
    refresh,
    optimisticInsertAction,
    confirmInsertAction,
    revertInsertAction,
    getActionForCell,
    getDelayForCell,
  } = useReadyBoardData(initialData);

  // Passive observer — emits events to ActionEventBus on actionMap transitions
  useActionObserver(actionMap);

  // Register non-component subscribers with cleanup
  useEffect(() => {
    const unsubToast = actionBus.subscribe(toastSubscriber);
    const unsubOrchestrator = actionBus.subscribe(
      createOrchestratorSubscriber(projectId),
    );

    return () => {
      unsubToast();
      unsubOrchestrator();
    };
  }, [projectId]);

  // ─── Expand/collapse state ─────────────────────────────
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showAddAreas, setShowAddAreas] = useState(false);

  // ─── Inject action buttons into the layout top bar ────
  const setTopBarActions = useTopBarActions();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    setTopBarActions(
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowAddAreas(true)}
          className="rounded border border-emerald-700 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-950/50 transition-colors"
        >
          + Add Areas
        </button>
        <button
          onClick={() => window.print()}
          className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Export PDF
        </button>
        <button
          onClick={() => refreshRef.current()}
          className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Refresh
        </button>
      </div>,
    );
    // Clear when unmounting (navigating away)
    return () => setTopBarActions(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTopBarActions]);

  const toggleFloorExpand = useCallback((floor: string) => {
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      next.has(floor) ? next.delete(floor) : next.add(floor);
      return next;
    });
  }, []);

  const toggleUnitExpand = useCallback((unitKey: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      next.has(unitKey) ? next.delete(unitKey) : next.add(unitKey);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allFloors = new Set(floors.map((f) => f.floor));
    const allUnits = new Set<string>();
    for (const f of floors) {
      for (const u of f.units) {
        allUnits.add(`${f.floor}:${u.unit_id ?? '__common__'}`);
      }
    }
    setExpandedFloors(allFloors);
    setExpandedUnits(allUnits);
  }, [floors]);

  const collapseAll = useCallback(() => {
    setExpandedFloors(new Set());
    setExpandedUnits(new Set());
  }, []);

  // ─── Filter state ──────────────────────────────────────
  const [selectedFloors, setSelectedFloors] = useState<Set<string>>(new Set());
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<GridStatus>>(new Set());

  const toggleFloor = useCallback((floor: string) => {
    setSelectedFloors((prev) => {
      const next = new Set(prev);
      next.has(floor) ? next.delete(floor) : next.add(floor);
      return next;
    });
  }, []);

  const toggleTrade = useCallback((trade: string) => {
    setSelectedTrades((prev) => {
      const next = new Set(prev);
      next.has(trade) ? next.delete(trade) : next.add(trade);
      return next;
    });
  }, []);

  const toggleStatus = useCallback((status: GridStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedFloors(new Set());
    setSelectedTrades(new Set());
    setSelectedStatuses(new Set());
  }, []);

  // ─── Derived: available floor numbers ──────────────────
  const floorNumbers = useMemo(() => floors.map((f) => f.floor), [floors]);

  // ─── Derived: filtered trades ──────────────────────────
  const filteredTrades = useMemo(
    () => (selectedTrades.size === 0 ? trades : trades.filter((t) => selectedTrades.has(t))),
    [trades, selectedTrades],
  );

  // ─── Derived: filtered floors ──────────────────────────
  const filteredFloors = useMemo<GridFloor[]>(() => {
    let result = floors;

    // Floor filter
    if (selectedFloors.size > 0) {
      result = result.filter((f) => selectedFloors.has(f.floor));
    }

    // Trade + Status filter: filter cells within each row
    if (selectedTrades.size > 0 || selectedStatuses.size > 0) {
      result = result
        .map((floor) => {
          const filteredRows = floor.allRows
            .map((row) => ({
              ...row,
              cells: row.cells.filter((cell) => {
                const tradeMatch = selectedTrades.size === 0 || selectedTrades.has(cell.trade_type);
                const statusMatch = selectedStatuses.size === 0 || selectedStatuses.has(cell.status);
                return tradeMatch && statusMatch;
              }),
            }))
            .filter((row) => row.cells.length > 0);
          return { ...floor, allRows: filteredRows };
        })
        .filter((floor) => floor.allRows.length > 0);
    }

    // Problems-only filter: keep only floors/units/areas with blocked, held, or almost
    if (problemsOnly) {
      const problemStatuses = new Set<GridStatus>(['blocked', 'held', 'almost']);
      result = result
        .map((floor) => {
          const filteredUnits = floor.units
            .map((unit) => ({
              ...unit,
              rows: unit.rows.filter((row) =>
                row.cells.some((c) => problemStatuses.has(c.status)),
              ),
            }))
            .filter((unit) => unit.rows.length > 0);
          const filteredAllRows = floor.allRows.filter((row) =>
            row.cells.some((c) => problemStatuses.has(c.status)),
          );
          return { ...floor, units: filteredUnits, allRows: filteredAllRows };
        })
        .filter((floor) => floor.allRows.length > 0);
    }

    return result;
  }, [floors, selectedFloors, selectedTrades, selectedStatuses, problemsOnly]);

  // ─── Derived: status counts (from filtered view) ──────
  const statusCounts = useMemo(() => {
    const counts: Record<GridStatus, number> = {
      ready: 0, in_progress: 0, almost: 0, blocked: 0, held: 0, done: 0, waiting: 0,
    };
    for (const floor of filteredFloors) {
      for (const row of floor.allRows) {
        for (const cell of row.cells) {
          counts[cell.status]++;
        }
      }
    }
    return counts;
  }, [filteredFloors]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading grid...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        No data available for this project.
      </div>
    );
  }

  // Single source of truth: getActionForCell decides what the panel renders
  const existingAction = selectedCell
    ? getActionForCell(selectedCell.area_id, selectedCell.trade_type)
    : null;

  const existingDelay = selectedCell
    ? getDelayForCell(selectedCell.area_id, selectedCell.trade_type)
    : null;

  return (
    <div className="space-y-3">
      {/* Hidden print header */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-xl font-bold text-black">ReadyBoard Status Report</h1>
        <p className="text-sm text-gray-600">
          Printed {new Date().toLocaleDateString()} — {new Date().toLocaleTimeString()}
        </p>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-3 print:hidden">
        {/* Floor quick-jump tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {floorNumbers.map((f) => (
            <button
              key={f}
              onClick={() => {
                if (!expandedFloors.has(f)) toggleFloorExpand(f);
                document.getElementById(`floor-${f}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                expandedFloors.has(f)
                  ? 'bg-amber-500/20 text-amber-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              F{f}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-zinc-700" />

        <button onClick={expandAll} className="text-xs text-zinc-500 hover:text-zinc-200">
          Expand all
        </button>
        <button onClick={collapseAll} className="text-xs text-zinc-500 hover:text-zinc-200">
          Collapse all
        </button>

        <button
          onClick={() => {
            setProblemsOnly((v) => !v);
            if (!problemsOnly) expandAll();
          }}
          className={`rounded px-3 py-1 text-xs transition-colors ${
            problemsOnly
              ? 'bg-red-500/20 text-red-400 font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {problemsOnly ? '✕ Problems only' : 'Show problems only'}
        </button>
      </div>

      {/* Filter bar */}
      <GridFilterBar
        floors={floorNumbers}
        trades={trades}
        selectedFloors={selectedFloors}
        selectedTrades={selectedTrades}
        selectedStatuses={selectedStatuses}
        onFloorToggle={toggleFloor}
        onTradeToggle={toggleTrade}
        onStatusToggle={toggleStatus}
        onClearAll={clearAllFilters}
      />

      {/* Legend */}
      <GridLegend
        counts={statusCounts}
        activeStatuses={selectedStatuses}
        onStatusToggle={toggleStatus}
      />

      {/* Grid table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full border-collapse">
          <GridHeader trades={filteredTrades} />
          <tbody>
            {filteredFloors.map((floor) => (
              <FloorSection
                key={floor.floor}
                floor={floor}
                trades={filteredTrades}
                expanded={expandedFloors.has(floor.floor)}
                expandedUnits={expandedUnits}
                onToggleFloor={() => toggleFloorExpand(floor.floor)}
                onToggleUnit={toggleUnitExpand}
                onSelectCell={selectCell}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Efficiency KPIs — self-contained, subscribes to bus internally */}
      <EfficiencyDashboard />

      {/* Add Areas modal */}
      {showAddAreas && (
        <AddAreasModal
          projectId={projectId}
          onClose={() => setShowAddAreas(false)}
          onSuccess={refresh}
          existingFloors={floorNumbers}
        />
      )}

      {/* Detail panel */}
      {selectedCell && (
        <GridDetailPanel
          cell={selectedCell}
          projectId={projectId}
          existingAction={existingAction}
          delay={existingDelay}
          safetyGateEnabled={initialData.safetyGateEnabled}
          onClose={() => selectCell(null)}
          onOptimisticInsert={optimisticInsertAction}
          onInsertSuccess={confirmInsertAction}
          onInsertRevert={revertInsertAction}
          onActionUpdate={refresh}
        />
      )}
    </div>
  );
}

// ─── Worst status helper ─────────────────────────────

const STATUS_PRIORITY: Record<GridStatus, number> = {
  blocked: 6, held: 5, almost: 4, in_progress: 3, ready: 2, done: 1, waiting: 0,
};

function worstStatus(rows: GridRowType[]): GridStatus {
  let worst: GridStatus = 'waiting';
  let worstPri = -1;
  for (const row of rows) {
    for (const cell of row.cells) {
      const pri = STATUS_PRIORITY[cell.status] ?? 0;
      if (pri > worstPri) {
        worstPri = pri;
        worst = cell.status;
      }
    }
  }
  return worst;
}

function statusCounts(rows: GridRowType[]) {
  const counts: Partial<Record<GridStatus, number>> = {};
  for (const row of rows) {
    for (const cell of row.cells) {
      counts[cell.status] = (counts[cell.status] ?? 0) + 1;
    }
  }
  return counts;
}

// ─── Floor Section (Level 1) ─────────────────────────

function FloorSection({
  floor,
  trades,
  expanded,
  expandedUnits,
  onToggleFloor,
  onToggleUnit,
  onSelectCell,
}: {
  floor: GridFloor;
  trades: string[];
  expanded: boolean;
  expandedUnits: Set<string>;
  onToggleFloor: () => void;
  onToggleUnit: (key: string) => void;
  onSelectCell: (cell: GridCellData) => void;
}) {
  const worst = useMemo(() => worstStatus(floor.allRows), [floor.allRows]);
  const counts = useMemo(() => statusCounts(floor.allRows), [floor.allRows]);
  const totalAreas = floor.allRows.length;
  const worstCfg = STATUS_CONFIG[worst];

  return (
    <>
      {/* Floor header row — click to expand/collapse */}
      <tr
        id={`floor-${floor.floor}`}
        className="cursor-pointer transition-colors hover:bg-zinc-800/50"
        onClick={onToggleFloor}
      >
        <td className="sticky left-0 z-10 border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-200">
          <span className="mr-2 text-zinc-500">{expanded ? '▼' : '▶'}</span>
          Floor {floor.floor}
          <span className="ml-3 text-xs font-normal text-zinc-500">
            {totalAreas} areas
          </span>
        </td>
        <td colSpan={trades.length} className="border border-zinc-800 bg-zinc-900 px-3 py-2">
          <div className="flex items-center gap-3">
            {/* Aggregate status bar */}
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
              {(['done', 'ready', 'in_progress', 'almost', 'blocked', 'held', 'waiting'] as GridStatus[]).map((s) => {
                const count = counts[s] ?? 0;
                if (count === 0) return null;
                const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
                return (
                  <div
                    key={s}
                    style={{ width: `${(count / total) * 100}%`, backgroundColor: STATUS_CONFIG[s].hex }}
                    className="h-full"
                  />
                );
              })}
            </div>
            {/* Worst status dot */}
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: worstCfg.hex }} />
              <span className="text-[10px] text-zinc-500">
                {counts.blocked ? `${counts.blocked} BLK` : ''}
                {counts.held ? ` ${counts.held} HLD` : ''}
                {counts.almost ? ` ${counts.almost} ALM` : ''}
              </span>
            </div>
          </div>
        </td>
      </tr>

      {/* Expanded: show units + floor-level areas */}
      {expanded && (() => {
        const realUnits = floor.units.filter((u) => u.unit_id !== null);
        const commonUnit = floor.units.find((u) => u.unit_id === null);

        // If floor has NO real units, render areas flat (no unit grouping)
        if (realUnits.length === 0 && commonUnit) {
          return commonUnit.rows.map((row) => (
            <GridRow key={row.area_id} row={row} onSelectCell={onSelectCell} />
          ));
        }

        return (
          <>
            {/* Real units (collapsible) */}
            {realUnits.map((unit) => {
              const unitKey = `${floor.floor}:${unit.unit_id}`;
              return (
                <UnitSection
                  key={unitKey}
                  unit={unit}
                  unitKey={unitKey}
                  trades={trades}
                  expanded={expandedUnits.has(unitKey)}
                  onToggle={() => onToggleUnit(unitKey)}
                  onSelectCell={onSelectCell}
                />
              );
            })}

            {/* Floor-level areas (no unit) — render flat after units */}
            {commonUnit && commonUnit.rows.length > 0 && (
              <>
                <tr>
                  <td colSpan={trades.length + 1} className="border-t border-zinc-800/50 pl-8 py-1 text-[10px] uppercase tracking-wider text-zinc-600">
                    Floor areas
                  </td>
                </tr>
                {commonUnit.rows.map((row) => (
                  <GridRow key={row.area_id} row={row} onSelectCell={onSelectCell} />
                ))}
              </>
            )}
          </>
        );
      })()}
    </>
  );
}

// ─── Unit Section (Level 2) ──────────────────────────

function UnitSection({
  unit,
  unitKey,
  trades,
  expanded,
  onToggle,
  onSelectCell,
}: {
  unit: GridUnit;
  unitKey: string;
  trades: string[];
  expanded: boolean;
  onToggle: () => void;
  onSelectCell: (cell: GridCellData) => void;
}) {
  const worst = useMemo(() => worstStatus(unit.rows), [unit.rows]);
  const worstCfg = STATUS_CONFIG[worst];
  const readyCount = useMemo(
    () => unit.rows.filter((r) => r.cells.every((c) => c.status === 'done' || c.status === 'ready')).length,
    [unit.rows],
  );

  return (
    <>
      {/* Unit header row */}
      <tr
        className="cursor-pointer transition-colors hover:bg-zinc-800/30"
        onClick={onToggle}
      >
        <td className="sticky left-0 z-10 border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-300">
          <span className="mr-2 text-zinc-600">{expanded ? '▼' : '▶'}</span>
          <span className="font-medium">Unit {unit.unit_name}</span>
          <span className="ml-2 text-zinc-600">
            {readyCount}/{unit.rows.length}
          </span>
          {/* Area codes preview */}
          {!expanded && unit.rows.some((r) => r.area_code) && (
            <span className="ml-2 text-[10px] text-zinc-600">
              {unit.rows.filter((r) => r.area_code).map((r) => r.area_code).join(' · ')}
            </span>
          )}
        </td>
        {/* Per-trade worst status cells */}
        {trades.map((trade) => {
          let cellWorst: GridStatus = 'waiting';
          let cellWorstPri = -1;
          for (const row of unit.rows) {
            const c = row.cells.find((cc) => cc.trade_type === trade);
            if (c) {
              const pri = STATUS_PRIORITY[c.status] ?? 0;
              if (pri > cellWorstPri) {
                cellWorstPri = pri;
                cellWorst = c.status;
              }
            }
          }
          const cfg = STATUS_CONFIG[cellWorst];
          return (
            <td key={trade} className="border border-zinc-800 bg-zinc-950 p-0">
              <div className="flex items-center justify-center py-1">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cfg.hex }}
                  title={`${cfg.label} (worst in unit)`}
                />
              </div>
            </td>
          );
        })}
      </tr>

      {/* Expanded: show area rows */}
      {expanded && unit.rows.map((row) => (
        <GridRow key={row.area_id} row={row} onSelectCell={onSelectCell} />
      ))}
    </>
  );
}
