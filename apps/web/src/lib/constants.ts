/** Milliseconds per day (86,400,000) */
export const MS_PER_DAY = 86_400_000;

/** Milliseconds per hour (3,600,000) */
export const MS_PER_HOUR = 3_600_000;

/** Days behind baseline before an item is flagged at-risk */
export const AT_RISK_THRESHOLD_DAYS = 3;

/** Rolling window in days for burn rate calculation */
export const BURN_RATE_WINDOW_DAYS = 14;

/** Human-readable labels for delay reason codes */
export const REASON_LABELS: Record<string, string> = {
  no_heat: 'No Heat',
  prior_trade: 'Prior Trade',
  no_access: 'No Access',
  inspection: 'Inspection',
  plumbing: 'Plumbing',
  material: 'Material',
  moisture: 'Moisture',
  safety: 'Safety Clearance',
};
