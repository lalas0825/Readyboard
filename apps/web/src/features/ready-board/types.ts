/** Derived status for each cell in the Ready Board grid */
export type GridStatus = 'ready' | 'in_progress' | 'almost' | 'blocked' | 'held' | 'done' | 'waiting';

/** Corrective action lifecycle derived from timestamps */
export type CorrectiveActionStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved';

/** Corrective action row joined with delay_log for grid display */
export type CorrectiveActionData = {
  id: string;
  delay_log_id: string;
  area_id: string;
  trade_name: string;
  assigned_to: string;
  assigned_to_name: string;
  deadline: string;
  note: string | null;
  created_by: string;
  created_at: string;
  status: CorrectiveActionStatus;
  /** True while the server action is in-flight (optimistic UI) */
  isOptimistic?: boolean;
};

/** Assignable user for the corrective action form */
export type AssignableUser = {
  id: string;
  name: string;
  role: string;
};

/** What each GridCell receives as props — the complete render contract */
export type GridCellData = {
  area_id: string;
  trade_type: string;
  sequence_order: number;
  effective_pct: number;
  status: GridStatus;
  has_alert: boolean;
  has_action: boolean;
  cost: number | null;
  delay_reason: string | null;
  delay_log_id: string | null;
  gc_pending: boolean;
};

/** One row in the grid (1 area = 14 cells) */
export type GridRow = {
  area_id: string;
  area_name: string;
  floor: string;
  cells: GridCellData[];
};

/** Group of rows by floor */
export type GridFloor = {
  floor: string;
  rows: GridRow[];
};

/** Raw cell data from Supabase (before status derivation) */
export type RawCellData = {
  area_id: string;
  area_name: string;
  floor: string;
  trade_type: string;
  sequence_order: number;
  effective_pct: number;
  all_gates_passed: boolean;
  gc_verification_pending: boolean;
};

/** Active delay data from Supabase */
export type DelayData = {
  id: string;
  area_id: string;
  trade_name: string;
  reason_code: string;
  cumulative_cost: number;
  daily_cost: number;
  man_hours: number;
  crew_size: number;
  started_at: string;
};

/** Visual config for each status */
export const STATUS_CONFIG: Record<GridStatus, { label: string; hex: string }> = {
  done:        { label: 'DONE', hex: '#3b82f6' },
  ready:       { label: 'RDY',  hex: '#4ade80' },
  in_progress: { label: 'WIP',  hex: '#60a5fa' },
  almost:      { label: 'ALM',  hex: '#fbbf24' },
  blocked:     { label: 'BLK',  hex: '#f87171' },
  held:        { label: 'HLD',  hex: '#c084fc' },
  waiting:     { label: '\u2014',    hex: '#3f3f46' },
};

/** Initial data passed from server component to client */
export type ReadyBoardInitialData = {
  rawCells: RawCellData[];
  delays: DelayData[];
  trades: string[];
  projectId: string;
  actions: CorrectiveActionData[];
  safetyGateEnabled: boolean;
};
