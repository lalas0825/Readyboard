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
  | 'moisture';

/** User roles (match DB CHECK constraint) */
export type UserRole =
  | 'foreman'
  | 'sub_pm'
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
