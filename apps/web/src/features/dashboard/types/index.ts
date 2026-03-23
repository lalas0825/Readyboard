export type ProjectMetrics = {
  projectId: string;
  projectName: string;
  overallPct: number;
  totalAreas: number;
  onTrack: number;
  attention: number;
  actionRequired: number;
};

export type DashboardAlert = {
  id: string;
  areaId: string;
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  dailyCost: number;
  cumulativeCost: number;
  daysBlocked: number;
  legalStatus: string | null;
  isChangeOrder: boolean;
  hasCorrectiveAction: boolean;
  correctiveActionStatus: string | null;
  correctiveActionId: string | null;
  correctiveActionNote: string | null;
  source?: 'delay' | 'schedule';
};

export type TrendSnapshot = {
  date: string;
  effectivePct: number;
  actualRate: number | null;
  benchmarkRate: number | null;
};

export type ProjectForecast = {
  trendData: TrendSnapshot[];
  scheduledDate: string | null;
  projectedDate: string | null;
  deltaDays: number | null;
  atRiskCount: number;
  criticalPathItems: number;
};

export type FinancialOverview = {
  totalDelayCost: number;
  totalChangeOrderAmount: number;
  totalFinancialImpact: number;
  pendingCOs: number;
};

import type { ScheduleComparisonRow } from '@/features/forecast/types';
export type { ScheduleComparisonRow };

export type DashboardData = {
  metrics: ProjectMetrics;
  alerts: DashboardAlert[];
  forecast: ProjectForecast;
  financial: FinancialOverview;
  scheduleComparison: ScheduleComparisonRow[];
};

/** Legal document types */
export type LegalDocType = 'nod' | 'rea' | 'evidence';

export type LegalDoc = {
  id: string;
  type: LegalDocType;
  sha256Hash: string | null;
  publishedToGc: boolean;
  publishedAt: string | null;
  sentAt: string | null;
  pdfUrl: string | null;
  openCount: number;
  createdAt: string;
  firstOpenedAt: string | null;
  receiptTrackingUuid: string | null;
  totalClaimAmount: number | null;
  areaName: string | null;
  tradeName: string | null;
  locale: string;
};
