export { DashboardTabs } from './components/DashboardTabs';
export { GCDashboard } from './components/GCDashboard';
export { LegalDocsTab } from './components/LegalDocsTab';
export { fetchDashboardData } from './services/fetchDashboardData';
export { fetchLegalDocs } from './services/fetchLegalDocs';
export { publishLegalDoc } from './services/publishLegalDoc';
export { updateAlertNote } from './services/updateAlertNote';
export { createArea } from './services/createArea';
export { createLegalDoc } from './services/createLegalDoc';
export { getDelayLogSummary } from './services/delayEngine';
export type {
  DelayLogSummary,
  DelayEngineResult,
  DelayLegalStatus,
} from './services/delayEngine';
export type {
  DashboardData,
  ProjectMetrics,
  DashboardAlert,
  ProjectForecast,
  TrendSnapshot,
  LegalDoc,
  LegalDocType,
} from './types';
