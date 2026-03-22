export type ScheduleItemRow = {
  id: string;
  projectId: string;
  areaName: string;
  tradeName: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  baselineFinish: string | null;
  actualFinish: string | null;
  p6ActivityId: string | null;
  areaId: string | null;
  isCritical: boolean;
};

export type ImportResult = {
  success: boolean;
  upserted: number;
  critical: number;
  unmappedAreas: string[];
  error?: string;
};

export type RefreshResult = {
  success: boolean;
  snapshotsWritten: number;
  atRiskCount: number;
};

export type ScheduleComparisonRow = {
  areaName: string;
  tradeName: string;
  baselineFinish: string | null;
  projectedDate: string | null;
  deltaDays: number | null;
  isCritical: boolean;
};

/** Shape of a field_report row used in burn rate calculation */
export type FieldReportForBurnRate = {
  progressPct: number;
  createdAt: string; // ISO date
};
