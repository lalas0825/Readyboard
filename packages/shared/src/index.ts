// @readyboard/shared — shared hooks, types, utils

// Types
export type {
  FieldReportStatus,
  FieldReportInput,
  ReasonCode,
  UserRole,
  PowerSyncStatus,
  AreaStatus,
  AssignedArea,
  PendingNod,
} from './types';

// Hooks
export {
  PowerSyncProvider,
  PowerSyncContext,
  usePowerSync,
  type PowerSyncContextValue,
} from './hooks/usePowerSync';

export { useFieldReport } from './hooks/useFieldReport';
export { useAreas } from './hooks/useAreas';

// Stores
export {
  useReportStore,
  type ReportStep,
  type ReportContext,
  type ReportFormData,
} from './stores/useReportStore';

// i18n
export {
  translations,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
  type TranslationKeys,
} from './i18n';
