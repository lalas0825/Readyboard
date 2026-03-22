'use client';

import { useReducer, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deriveStatus } from '../lib/deriveStatus';
import { deriveActionStatus } from '../lib/deriveActionStatus';
import { fetchGridData } from '../services/fetchGridData';
import type {
  GridFloor,
  GridRow,
  GridCellData,
  RawCellData,
  DelayData,
  CorrectiveActionData,
  ReadyBoardInitialData,
} from '../types';

// ─── State ────────────────────────────────────────────

/** @internal — exported for testing only */
export type GridState = {
  cellMap: Map<string, RawCellData>;
  delayMap: Map<string, DelayData>;
  delayIdMap: Map<string, DelayData>; // key: delay_log.id → for Realtime O(1) lookup
  actionMap: Map<string, CorrectiveActionData>; // key: area_id:trade_name → single source of truth
  floors: GridFloor[];
  trades: string[];
  areaIds: Set<string>;
  selectedCell: GridCellData | null;
  isLoading: boolean;
  error: string | null;
};

/** @internal — exported for testing only */
export const INITIAL_STATE: GridState = {
  cellMap: new Map(),
  delayMap: new Map(),
  delayIdMap: new Map(),
  actionMap: new Map(),
  floors: [],
  trades: [],
  areaIds: new Set(),
  selectedCell: null,
  isLoading: true,
  error: null,
};

// ─── Actions ──────────────────────────────────────────

/** @internal — exported for testing only */
export type GridAction =
  | { type: 'INIT'; data: ReadyBoardInitialData }
  | { type: 'CELL_UPDATE'; area_id: string; trade_type: string; effective_pct: number }
  // Optimistic lifecycle ──────────────────────────
  | { type: 'ACTION_OPTIMISTIC_INSERT'; action: CorrectiveActionData }
  | { type: 'ACTION_INSERT_SUCCESS'; tempId: string; action: CorrectiveActionData }
  | { type: 'ACTION_INSERT_REVERT'; tempId: string; area_id: string; trade_name: string }
  // Realtime sync ─────────────────────────────────
  | { type: 'ACTION_UPSERT'; action: CorrectiveActionData }
  | { type: 'SELECT_CELL'; cell: GridCellData | null }
  | { type: 'ERROR'; error: string };

// ─── Helpers ──────────────────────────────────────────

function buildRow(
  area_id: string,
  cellMap: Map<string, RawCellData>,
  delayMap: Map<string, DelayData>,
  actionMap: Map<string, CorrectiveActionData>,
  trades: string[],
): GridRow {
  const rawCells = trades
    .map((trade) => cellMap.get(`${area_id}:${trade}`))
    .filter((c): c is RawCellData => !!c)
    .sort((a, b) => a.sequence_order - b.sequence_order);

  const cells: GridCellData[] = rawCells.map((cell, i) => {
    const priors = rawCells.slice(0, i);
    const delay = delayMap.get(`${cell.area_id}:${cell.trade_type}`);
    const action = actionMap.get(`${cell.area_id}:${cell.trade_type}`);
    // has_action = any non-resolved action (including optimistic → wrench appears immediately)
    const hasAction = !!action && action.status !== 'resolved';
    return {
      area_id: cell.area_id,
      trade_type: cell.trade_type,
      sequence_order: cell.sequence_order,
      effective_pct: cell.effective_pct,
      status: deriveStatus(cell, priors, delay),
      has_alert: !!delay,
      has_action: hasAction,
      cost: delay ? delay.cumulative_cost : null,
      delay_reason: delay ? delay.reason_code : null,
      delay_log_id: delay?.id ?? null,
      gc_pending: cell.gc_verification_pending,
    };
  });

  return {
    area_id,
    area_name: rawCells[0]?.area_name ?? 'Unknown',
    floor: rawCells[0]?.floor ?? '?',
    cells,
  };
}

function buildAllFloors(
  cellMap: Map<string, RawCellData>,
  delayMap: Map<string, DelayData>,
  actionMap: Map<string, CorrectiveActionData>,
  trades: string[],
): GridFloor[] {
  const areaIds = new Set<string>();
  for (const cell of cellMap.values()) {
    areaIds.add(cell.area_id);
  }

  const rows: GridRow[] = [];
  for (const areaId of areaIds) {
    rows.push(buildRow(areaId, cellMap, delayMap, actionMap, trades));
  }

  const floorMap = new Map<string, GridRow[]>();
  for (const row of rows) {
    const arr = floorMap.get(row.floor) ?? [];
    arr.push(row);
    floorMap.set(row.floor, arr);
  }

  return Array.from(floorMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([floor, floorRows]) => ({
      floor,
      rows: floorRows.sort((a, b) => a.area_name.localeCompare(b.area_name)),
    }));
}

/** Surgically rebuild one row inside the floor list — O(rows-in-floor) */
function rebuildRowInFloors(
  floors: GridFloor[],
  area_id: string,
  cellMap: Map<string, RawCellData>,
  delayMap: Map<string, DelayData>,
  actionMap: Map<string, CorrectiveActionData>,
  trades: string[],
): GridFloor[] {
  return floors.map((floor) => {
    const rowIdx = floor.rows.findIndex((r) => r.area_id === area_id);
    if (rowIdx === -1) return floor; // unchanged floor — same reference
    const newRow = buildRow(area_id, cellMap, delayMap, actionMap, trades);
    const newRows = [...floor.rows];
    newRows[rowIdx] = newRow;
    return { ...floor, rows: newRows };
  });
}

/** Find a cell in rebuilt floors */
function findCellInFloors(
  floors: GridFloor[],
  area_id: string,
  trade_type: string,
): GridCellData | null {
  for (const floor of floors) {
    const row = floor.rows.find((r) => r.area_id === area_id);
    if (row) return row.cells.find((c) => c.trade_type === trade_type) ?? null;
  }
  return null;
}

/**
 * Guardia de Seguridad: validates whether an action mutation should proceed.
 *
 * Race condition scenario:
 *   1. Client dispatches ACTION_OPTIMISTIC_INSERT (tempId=abc, isOptimistic=true)
 *   2. Realtime delivers ACTION_UPSERT (id=real-uuid, isOptimistic=undefined)
 *   3. Server Action resolves → ACTION_INSERT_SUCCESS (tempId=abc)
 *
 * Without this guard, step 3 would overwrite the authoritative Realtime data.
 * Rule: a late Server Action response NEVER overwrites a Realtime-confirmed entry.
 */
/** @internal — exported for testing only */
export function canProceedWithAction(
  existing: CorrectiveActionData | undefined,
  actionType: 'OPTIMISTIC_INSERT' | 'INSERT_SUCCESS' | 'INSERT_REVERT' | 'UPSERT',
  tempId?: string,
): boolean {
  // Realtime (UPSERT) → authoritative from DB, always wins
  if (actionType === 'UPSERT') return true;

  // Optimistic insert → only if no real entry already occupies the slot
  if (actionType === 'OPTIMISTIC_INSERT') {
    if (existing && !existing.isOptimistic) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Guard] OPTIMISTIC_INSERT blocked — real entry already exists');
      }
      return false;
    }
    return true;
  }

  // SUCCESS: Realtime already replaced optimistic → no-op
  if (actionType === 'INSERT_SUCCESS') {
    if (!existing || !existing.isOptimistic || existing.id !== tempId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Guard] INSERT_SUCCESS blocked — tempId=${tempId}, existing=${existing?.id}, isOptimistic=${existing?.isOptimistic}`);
      }
      return false;
    }
    return true;
  }

  // REVERT: only revert our own optimistic entry
  if (actionType === 'INSERT_REVERT') {
    if (!existing?.isOptimistic || existing.id !== tempId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Guard] INSERT_REVERT blocked — tempId=${tempId}, existing=${existing?.id}, isOptimistic=${existing?.isOptimistic}`);
      }
      return false;
    }
    return true;
  }

  return true;
}

/** Pure rebuild: update actionMap + surgically rebuild one row + refresh selectedCell */
function applyActionChange(
  state: GridState,
  newActionMap: Map<string, CorrectiveActionData>,
  area_id: string,
  trade_name: string,
): Pick<GridState, 'actionMap' | 'floors' | 'selectedCell'> {
  const newFloors = rebuildRowInFloors(
    state.floors, area_id, state.cellMap, state.delayMap, newActionMap, state.trades,
  );
  let newSelectedCell = state.selectedCell;
  if (state.selectedCell?.area_id === area_id && state.selectedCell?.trade_type === trade_name) {
    newSelectedCell = findCellInFloors(newFloors, area_id, trade_name) ?? state.selectedCell;
  }
  return { actionMap: newActionMap, floors: newFloors, selectedCell: newSelectedCell };
}

// ─── Reducer ──────────────────────────────────────────

/** @internal — exported for testing only */
export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'INIT': {
      const { rawCells, delays, trades, actions } = action.data;

      const cellMap = new Map<string, RawCellData>();
      for (const c of rawCells) {
        cellMap.set(`${c.area_id}:${c.trade_type}`, c);
      }

      const delayMap = new Map<string, DelayData>();
      const delayIdMap = new Map<string, DelayData>();
      for (const d of delays) {
        delayMap.set(`${d.area_id}:${d.trade_name}`, d);
        delayIdMap.set(d.id, d);
      }

      const actionMap = new Map<string, CorrectiveActionData>();
      for (const a of actions) {
        actionMap.set(`${a.area_id}:${a.trade_name}`, a);
      }

      const areaIds = new Set(rawCells.map((c) => c.area_id));
      const floors = buildAllFloors(cellMap, delayMap, actionMap, trades);

      return {
        cellMap,
        delayMap,
        delayIdMap,
        actionMap,
        floors,
        trades,
        areaIds,
        selectedCell: null,
        isLoading: false,
        error: null,
      };
    }

    case 'CELL_UPDATE': {
      const key = `${action.area_id}:${action.trade_type}`;
      const existing = state.cellMap.get(key);
      if (!existing) return state;

      const newCellMap = new Map(state.cellMap);
      newCellMap.set(key, { ...existing, effective_pct: action.effective_pct });

      const newFloors = rebuildRowInFloors(
        state.floors, action.area_id, newCellMap, state.delayMap, state.actionMap, state.trades,
      );
      return { ...state, cellMap: newCellMap, floors: newFloors };
    }

    // ── Optimistic lifecycle (guarded by canProceedWithAction) ──

    case 'ACTION_OPTIMISTIC_INSERT': {
      const a = action.action;
      const key = `${a.area_id}:${a.trade_name}`;
      if (!canProceedWithAction(state.actionMap.get(key), 'OPTIMISTIC_INSERT')) return state;

      const newActionMap = new Map(state.actionMap);
      newActionMap.set(key, { ...a, isOptimistic: true });
      return { ...state, ...applyActionChange(state, newActionMap, a.area_id, a.trade_name) };
    }

    case 'ACTION_INSERT_SUCCESS': {
      const a = action.action;
      const key = `${a.area_id}:${a.trade_name}`;
      if (!canProceedWithAction(state.actionMap.get(key), 'INSERT_SUCCESS', action.tempId)) return state;

      const newActionMap = new Map(state.actionMap);
      newActionMap.set(key, { ...a, isOptimistic: undefined });
      return { ...state, ...applyActionChange(state, newActionMap, a.area_id, a.trade_name) };
    }

    case 'ACTION_INSERT_REVERT': {
      const key = `${action.area_id}:${action.trade_name}`;
      if (!canProceedWithAction(state.actionMap.get(key), 'INSERT_REVERT', action.tempId)) return state;

      const newActionMap = new Map(state.actionMap);
      newActionMap.delete(key);
      return { ...state, ...applyActionChange(state, newActionMap, action.area_id, action.trade_name) };
    }

    // ── Realtime sync (authoritative — always wins) ──

    case 'ACTION_UPSERT': {
      const a = action.action;
      const key = `${a.area_id}:${a.trade_name}`;
      if (!canProceedWithAction(state.actionMap.get(key), 'UPSERT')) return state;

      const newActionMap = new Map(state.actionMap);
      newActionMap.set(key, a); // real data, isOptimistic: undefined
      return { ...state, ...applyActionChange(state, newActionMap, a.area_id, a.trade_name) };
    }

    case 'SELECT_CELL':
      return { ...state, selectedCell: action.cell };

    case 'ERROR':
      return { ...state, error: action.error, isLoading: false };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────

export function useReadyBoardData(initialData: ReadyBoardInitialData) {
  const [state, dispatch] = useReducer(gridReducer, INITIAL_STATE);

  // Initialize with server-fetched data
  useEffect(() => {
    dispatch({ type: 'INIT', data: initialData });
  }, [initialData]);

  // Supabase Realtime: area_trade_status + corrective_actions
  useEffect(() => {
    if (state.areaIds.size === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel('readyboard-grid')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'area_trade_status' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const areaId = row.area_id as string;
          if (!state.areaIds.has(areaId)) return;

          dispatch({
            type: 'CELL_UPDATE',
            area_id: areaId,
            trade_type: row.trade_type as string,
            effective_pct: Number(row.effective_pct),
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corrective_actions' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row?.delay_log_id) return;

          // O(1) lookup: delay_log_id → area_id + trade_name
          const delay = state.delayIdMap.get(row.delay_log_id as string);
          if (!delay) return; // not for our project's areas

          dispatch({
            type: 'ACTION_UPSERT',
            action: {
              id: row.id as string,
              delay_log_id: row.delay_log_id as string,
              area_id: delay.area_id,
              trade_name: delay.trade_name,
              assigned_to: row.assigned_to as string,
              assigned_to_name: 'Unknown', // Realtime has no JOINs; next poll fills name
              deadline: row.deadline as string,
              note: (row.note as string) ?? null,
              created_by: row.created_by as string,
              created_at: row.created_at as string,
              status: deriveActionStatus({
                resolved_at: (row.resolved_at as string) ?? null,
                in_resolution_at: (row.in_resolution_at as string) ?? null,
                acknowledged_at: (row.acknowledged_at as string) ?? null,
              }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.areaIds, state.delayIdMap]);

  // Polling fallback for development (Realtime requires auth + RLS)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const freshData = await fetchGridData(initialData.projectId);
        dispatch({ type: 'INIT', data: freshData });
      } catch {
        // Silent failure — polling is best-effort
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [initialData.projectId]);

  // ── Exposed callbacks ──────────────────────────

  const selectCell = useCallback((cell: GridCellData | null) => {
    dispatch({ type: 'SELECT_CELL', cell });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const freshData = await fetchGridData(initialData.projectId);
      dispatch({ type: 'INIT', data: freshData });
    } catch (err) {
      dispatch({ type: 'ERROR', error: String(err) });
    }
  }, [initialData.projectId]);

  /** Step 1: insert optimistic entry (wrench appears, form stays visible) */
  const optimisticInsertAction = useCallback((action: CorrectiveActionData) => {
    dispatch({ type: 'ACTION_OPTIMISTIC_INSERT', action });
  }, []);

  /** Step 2a: server confirmed — replace optimistic with real data */
  const confirmInsertAction = useCallback((tempId: string, action: CorrectiveActionData) => {
    dispatch({ type: 'ACTION_INSERT_SUCCESS', tempId, action });
  }, []);

  /** Step 2b: server failed — remove optimistic entry, wrench disappears */
  const revertInsertAction = useCallback((tempId: string, area_id: string, trade_name: string) => {
    dispatch({ type: 'ACTION_INSERT_REVERT', tempId, area_id, trade_name });
  }, []);

  /** Single source of truth: always consult this to decide what to render */
  const getActionForCell = useCallback(
    (area_id: string, trade_type: string): CorrectiveActionData | null => {
      return state.actionMap.get(`${area_id}:${trade_type}`) ?? null;
    },
    [state.actionMap],
  );

  /** Get delay data for a specific cell (for detail panel) */
  const getDelayForCell = useCallback(
    (area_id: string, trade_type: string): DelayData | null => {
      return state.delayMap.get(`${area_id}:${trade_type}`) ?? null;
    },
    [state.delayMap],
  );

  return {
    floors: state.floors,
    trades: state.trades,
    selectedCell: state.selectedCell,
    isLoading: state.isLoading,
    error: state.error,
    projectId: initialData.projectId,
    /** @internal — exposed for useActionNotifications observer only */
    actionMap: state.actionMap,
    selectCell,
    refresh,
    optimisticInsertAction,
    confirmInsertAction,
    revertInsertAction,
    getActionForCell,
    getDelayForCell,
  };
}
