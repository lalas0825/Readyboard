import type { CorrectiveActionStatus } from '../types';

/**
 * Derives corrective action lifecycle status from timestamp fields.
 * Priority: resolved (most terminal) → in_progress → acknowledged → open.
 */
export function deriveActionStatus(row: {
  resolved_at: string | null;
  in_resolution_at: string | null;
  acknowledged_at: string | null;
}): CorrectiveActionStatus {
  if (row.resolved_at) return 'resolved';
  if (row.in_resolution_at) return 'in_progress';
  if (row.acknowledged_at) return 'acknowledged';
  return 'open';
}
