/** Field report status values */
export type FieldReportStatus = 'done' | 'working' | 'blocked';

/** Delay reason codes (match DB CHECK constraint) */
export type ReasonCode =
  | 'no_heat'
  | 'prior_trade'
  | 'no_access'
  | 'inspection'
  | 'plumbing'
  | 'material'
  | 'moisture'
  | 'other';

/** User roles (match DB CHECK constraint) */
export type UserRole =
  | 'foreman'
  | 'sub_pm'
  | 'sub_super'
  | 'superintendent'
  | 'gc_super'
  | 'gc_pm'
  | 'gc_admin'
  | 'owner';

/** Input for creating a field report in local SQLite */
export type FieldReportInput = {
  area_id: string;
  user_id: string;
  trade_name: string;
  status: FieldReportStatus;
  progress_pct: number;
  reason_code?: ReasonCode;
  notes?: string;
  gps_lat?: number;
  gps_lng?: number;
  photo_url?: string;
  device_id?: string;
  app_version?: string;
};

/** PowerSync sync status for UI consumption */
export type PowerSyncStatus = {
  connected: boolean;
  lastSyncedAt: Date | null;
  hasSynced: boolean;
};

/** Derived area status for Foreman Home Screen */
export type AreaStatus = 'ready' | 'almost' | 'working' | 'blocked' | 'held';

/** Reporting mode: percentage slider or granular checklist */
export type ReportingMode = 'percentage' | 'checklist';

/** Area with derived status for foreman display */
export type AssignedArea = {
  id: string;
  name: string;
  floor: string;
  area_type: string;
  project_id: string;
  trade_name: string;
  effective_pct: number;
  all_gates_passed: boolean;
  gc_verification_pending: boolean;
  reporting_mode: ReportingMode;
  status: AreaStatus;
  /** ISO timestamp of most recent field_report for this area+trade (null if none) */
  last_report_at: string | null;
  /** Unit FK — null for legacy/common areas */
  unit_id: string | null;
  /** Denormalized unit name for grouping (e.g. "24A") */
  unit_name: string | null;
  /** Building-plan area code (e.g. "B.24A.1") */
  area_code: string | null;
  /** Human description (e.g. "Master Bath - Marble, double vanity") */
  description: string | null;
  /** Sort order within unit */
  sort_order: number;
};

/** Input for creating a delay_log in local SQLite */
export type DelayLogInput = {
  area_id: string;
  trade_name: string;
  reason_code: ReasonCode;
};

/** Unsent NOD draft linked to a foreman's area */
export type PendingNod = {
  nod_id: string;
  area_id: string;
  area_name: string;
  reason_code: string;
  /** Denormalized for grouping in Legal tab */
  unit_name: string | null;
  /** Area code for display */
  area_code: string | null;
};
