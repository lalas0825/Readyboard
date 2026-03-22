export type ExecutiveReportData = {
  generatedAt: string;
  project: {
    id: string;
    name: string;
    address: string | null;
    overallPct: number;
    totalAreas: number;
    areasOnTrack: number;
    areasAtRisk: number;
  };
  schedule: {
    scheduledFinish: string | null;
    projectedFinish: string | null;
    deltaDays: number | null;
    criticalPathItems: number;
    manualOverrides: number;
  };
  topRisks: Array<{
    areaName: string;
    tradeName: string;
    deltaDays: number;
    baselineFinish: string | null;
    projectedDate: string | null;
    isCritical: boolean;
  }>;
  financial: {
    totalDelayCost: number;
    totalApprovedCOs: number;
    totalPendingCOs: number;
    totalFinancialImpact: number;
    activeDelays: number;
  };
  activeDelays: Array<{
    areaName: string;
    tradeName: string;
    reasonCode: string;
    daysBlocked: number;
    dailyCost: number;
    cumulativeCost: number;
    legalStatus: string | null;
  }>;
};
