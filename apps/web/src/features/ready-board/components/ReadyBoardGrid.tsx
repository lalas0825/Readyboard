'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { GridPrintButton } from './GridPrintButton';
import { EfficiencyDashboard } from './EfficiencyDashboard';
import type { ReadyBoardInitialData, GridStatus, GridFloor } from '../types';

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

    return result;
  }, [floors, selectedFloors, selectedTrades, selectedStatuses]);

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

      {/* Header bar */}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold text-zinc-100">Ready Board</h2>
        <div className="flex items-center gap-2">
          <GridPrintButton show={filteredFloors.length > 0} />
          <button
            onClick={refresh}
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>
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
              <FloorGroup key={floor.floor} floor={floor} trades={filteredTrades} onSelectCell={selectCell} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Efficiency KPIs — self-contained, subscribes to bus internally */}
      <EfficiencyDashboard />

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

/** Floor separator + rows */
function FloorGroup({
  floor,
  trades,
  onSelectCell,
}: {
  floor: import('../types').GridFloor;
  trades: string[];
  onSelectCell: (cell: import('../types').GridCellData) => void;
}) {
  return (
    <>
      {/* Floor header row */}
      <tr>
        <td
          colSpan={trades.length + 1}
          className="border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-300"
        >
          Floor {floor.floor}
        </td>
      </tr>
      {/* Area rows */}
      {floor.allRows.map((row) => (
        <GridRow key={row.area_id} row={row} onSelectCell={onSelectCell} />
      ))}
    </>
  );
}
