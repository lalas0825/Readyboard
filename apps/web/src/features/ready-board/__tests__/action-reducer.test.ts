/**
 * Blindaje Operativo Permanente — action reducer integrity tests.
 *
 * Tests the REAL canProceedWithAction guard and gridReducer to ensure
 * race conditions between optimistic UI, Server Actions, and Realtime
 * never corrupt the actionMap.
 *
 * Run: npm test -w apps/web
 */

import { describe, it, expect } from 'vitest';
import {
  canProceedWithAction,
  gridReducer,
  INITIAL_STATE,
  type GridAction,
} from '../hooks/useReadyBoardData';
import type {
  CorrectiveActionData,
  ReadyBoardInitialData,
} from '../types';

// ─── Factories ────────────────────────────────────────

function makeAction(overrides: Partial<CorrectiveActionData> = {}): CorrectiveActionData {
  return {
    id: 'default-id',
    delay_log_id: 'dl-1',
    area_id: 'area-1',
    trade_name: 'Plumbing',
    assigned_to: 'user-1',
    assigned_to_name: 'Carlos',
    deadline: '2026-03-24',
    note: null,
    created_by: 'gc-1',
    created_at: '2026-03-21T10:00:00Z',
    status: 'open',
    ...overrides,
  };
}

function makeInitialData(actions: CorrectiveActionData[] = []): ReadyBoardInitialData {
  return {
    projectId: 'proj-1',
    trades: ['Plumbing', 'Framing'],
    rawCells: [
      {
        area_id: 'area-1',
        area_name: 'Bath 21C',
        floor: '2',
        trade_type: 'Plumbing',
        sequence_order: 1,
        effective_pct: 50,
        all_gates_passed: false,
        gc_verification_pending: false,
      },
      {
        area_id: 'area-1',
        area_name: 'Bath 21C',
        floor: '2',
        trade_type: 'Framing',
        sequence_order: 2,
        effective_pct: 0,
        all_gates_passed: false,
        gc_verification_pending: false,
      },
    ],
    delays: [
      {
        id: 'dl-1',
        area_id: 'area-1',
        trade_name: 'Plumbing',
        reason_code: 'material',
        cumulative_cost: 1200,
        daily_cost: 400,
        man_hours: 16,
        crew_size: 2,
        started_at: '2026-03-20T08:00:00Z',
      },
    ],
    actions,
    safetyGateEnabled: false,
  };
}

/** Dispatch a sequence of actions through the real reducer */
function reduceActions(actions: GridAction[]) {
  let state = INITIAL_STATE;
  for (const action of actions) {
    state = gridReducer(state, action);
  }
  return state;
}

const TEMP_ID = 'temp-abc-123';
const REAL_ID = 'real-uuid-456';
const KEY = 'area-1:Plumbing';

// ═══════════════════════════════════════════════════════
// canProceedWithAction — Unit Tests (Guard Logic)
// ═══════════════════════════════════════════════════════

describe('canProceedWithAction', () => {
  it('UPSERT always allowed on empty slot', () => {
    expect(canProceedWithAction(undefined, 'UPSERT')).toBe(true);
  });

  it('UPSERT always allowed over existing entry', () => {
    const existing = makeAction({ id: 'existing', isOptimistic: false });
    expect(canProceedWithAction(existing, 'UPSERT')).toBe(true);
  });

  it('UPSERT always allowed over optimistic entry', () => {
    const existing = makeAction({ id: TEMP_ID, isOptimistic: true });
    expect(canProceedWithAction(existing, 'UPSERT')).toBe(true);
  });

  it('OPTIMISTIC_INSERT allowed on empty slot', () => {
    expect(canProceedWithAction(undefined, 'OPTIMISTIC_INSERT')).toBe(true);
  });

  it('OPTIMISTIC_INSERT blocked by real entry (Ticket Unico)', () => {
    const existing = makeAction({ id: REAL_ID, status: 'acknowledged' });
    expect(canProceedWithAction(existing, 'OPTIMISTIC_INSERT')).toBe(false);
  });

  it('INSERT_SUCCESS allowed when optimistic matches tempId', () => {
    const existing = makeAction({ id: TEMP_ID, isOptimistic: true });
    expect(canProceedWithAction(existing, 'INSERT_SUCCESS', TEMP_ID)).toBe(true);
  });

  it('INSERT_SUCCESS blocked when Realtime already replaced optimistic', () => {
    const existing = makeAction({ id: REAL_ID, isOptimistic: undefined });
    expect(canProceedWithAction(existing, 'INSERT_SUCCESS', TEMP_ID)).toBe(false);
  });

  it('INSERT_SUCCESS blocked when entry was removed', () => {
    expect(canProceedWithAction(undefined, 'INSERT_SUCCESS', TEMP_ID)).toBe(false);
  });

  it('INSERT_SUCCESS blocked with mismatched tempId', () => {
    const existing = makeAction({ id: 'temp-OTHER', isOptimistic: true });
    expect(canProceedWithAction(existing, 'INSERT_SUCCESS', TEMP_ID)).toBe(false);
  });

  it('INSERT_REVERT allowed when optimistic matches tempId', () => {
    const existing = makeAction({ id: TEMP_ID, isOptimistic: true });
    expect(canProceedWithAction(existing, 'INSERT_REVERT', TEMP_ID)).toBe(true);
  });

  it('INSERT_REVERT blocked when entry is real (Realtime arrived)', () => {
    const existing = makeAction({ id: REAL_ID });
    expect(canProceedWithAction(existing, 'INSERT_REVERT', TEMP_ID)).toBe(false);
  });

  it('INSERT_REVERT blocked when entry is gone', () => {
    expect(canProceedWithAction(undefined, 'INSERT_REVERT', TEMP_ID)).toBe(false);
  });

  it('INSERT_REVERT blocked with mismatched tempId', () => {
    const existing = makeAction({ id: 'temp-OTHER', isOptimistic: true });
    expect(canProceedWithAction(existing, 'INSERT_REVERT', TEMP_ID)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// gridReducer — Integration Tests (Full State Flow)
// ═══════════════════════════════════════════════════════

describe('gridReducer — race conditions', () => {
  const initAction: GridAction = { type: 'INIT', data: makeInitialData() };

  it('Scenario 1: Realtime beats Server Action — SUCCESS is no-op', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });
    const realtimeData = makeAction({ id: REAL_ID, assigned_to_name: 'Carlos RT' });
    const serverData = makeAction({ id: REAL_ID, assigned_to_name: 'Carlos SA' });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
      { type: 'ACTION_UPSERT', action: realtimeData },
      { type: 'ACTION_INSERT_SUCCESS', tempId: TEMP_ID, action: serverData },
    ]);

    const entry = state.actionMap.get(KEY)!;
    expect(entry.id).toBe(REAL_ID);
    expect(entry.assigned_to_name).toBe('Carlos RT'); // Realtime data preserved
    expect(entry.isOptimistic).toBeUndefined();
  });

  it('Scenario 2: Server Action beats Realtime — both succeed', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });
    const serverData = makeAction({ id: REAL_ID, assigned_to_name: 'Carlos SA' });
    const realtimeData = makeAction({ id: REAL_ID, assigned_to_name: 'Carlos RT' });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
      { type: 'ACTION_INSERT_SUCCESS', tempId: TEMP_ID, action: serverData },
      { type: 'ACTION_UPSERT', action: realtimeData },
    ]);

    const entry = state.actionMap.get(KEY)!;
    expect(entry.assigned_to_name).toBe('Carlos RT'); // Realtime is last write
    expect(entry.isOptimistic).toBeUndefined();
  });

  it('Scenario 3: Server fails — REVERT clears optimistic entry', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
      { type: 'ACTION_INSERT_REVERT', tempId: TEMP_ID, area_id: 'area-1', trade_name: 'Plumbing' },
    ]);

    expect(state.actionMap.has(KEY)).toBe(false);
  });

  it('Scenario 4: Late REVERT after Realtime — real data preserved', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });
    const realtimeData = makeAction({ id: REAL_ID });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
      { type: 'ACTION_UPSERT', action: realtimeData },
      { type: 'ACTION_INSERT_REVERT', tempId: TEMP_ID, area_id: 'area-1', trade_name: 'Plumbing' },
    ]);

    const entry = state.actionMap.get(KEY)!;
    expect(entry.id).toBe(REAL_ID); // Real data NOT reverted
  });

  it('Scenario 5: Ticket Unico — OPTIMISTIC_INSERT blocked by real entry', () => {
    const existingAction = makeAction({ id: REAL_ID, status: 'acknowledged' });
    const initWithAction: GridAction = { type: 'INIT', data: makeInitialData([existingAction]) };
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });

    const state = reduceActions([
      initWithAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
    ]);

    const entry = state.actionMap.get(KEY)!;
    expect(entry.id).toBe(REAL_ID); // Original preserved
    expect(entry.isOptimistic).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════
// gridReducer — Grid Integrity (has_action on cells)
// ═══════════════════════════════════════════════════════

describe('gridReducer — has_action on GridCellData', () => {
  const initAction: GridAction = { type: 'INIT', data: makeInitialData() };

  function getCell(state: ReturnType<typeof reduceActions>, trade: string) {
    for (const floor of state.floors) {
      for (const row of floor.rows) {
        const cell = row.cells.find((c) => c.trade_type === trade);
        if (cell) return cell;
      }
    }
    return null;
  }

  it('has_action=false when no action exists', () => {
    const state = reduceActions([initAction]);
    const cell = getCell(state, 'Plumbing');
    expect(cell?.has_action).toBe(false);
  });

  it('has_action=true after OPTIMISTIC_INSERT (wrench appears immediately)', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
    ]);

    const cell = getCell(state, 'Plumbing');
    expect(cell?.has_action).toBe(true);
  });

  it('has_action=true after INSERT_SUCCESS (wrench stays)', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });
    const serverData = makeAction({ id: REAL_ID });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
      { type: 'ACTION_INSERT_SUCCESS', tempId: TEMP_ID, action: serverData },
    ]);

    const cell = getCell(state, 'Plumbing');
    expect(cell?.has_action).toBe(true);
  });

  it('has_action=false after INSERT_REVERT (wrench disappears)', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
      { type: 'ACTION_INSERT_REVERT', tempId: TEMP_ID, area_id: 'area-1', trade_name: 'Plumbing' },
    ]);

    const cell = getCell(state, 'Plumbing');
    expect(cell?.has_action).toBe(false);
  });

  it('has_action=false for resolved action', () => {
    const resolved = makeAction({ id: REAL_ID, status: 'resolved' });

    const state = reduceActions([
      { type: 'INIT', data: makeInitialData([resolved]) },
    ]);

    const cell = getCell(state, 'Plumbing');
    expect(cell?.has_action).toBe(false);
  });

  it('unrelated cell unchanged after action on Plumbing', () => {
    const optimistic = makeAction({ id: TEMP_ID, isOptimistic: true });

    const state = reduceActions([
      initAction,
      { type: 'ACTION_OPTIMISTIC_INSERT', action: optimistic },
    ]);

    const framingCell = getCell(state, 'Framing');
    expect(framingCell?.has_action).toBe(false); // Only Plumbing affected
  });
});
