'use server';

import { createServiceClient } from '@/lib/supabase/service';

// ─── Audit Action Types (must match DB CHECK constraint) ──────

export type AuditAction =
  | 'manual_override'
  | 'status_change'
  | 'scope_change'
  | 'config_change'
  | 'import'
  | 'legal_doc_sent'
  | 'legal_doc_published'
  | 'legal_draft_created'
  | 'change_order_created'
  | 'change_order_approved'
  | 'change_order_rejected'
  | 'ca_created'
  | 'ca_acknowledged'
  | 'ca_resolved'
  | 'rea_generated'
  | 'evidence_package_generated'
  | 'receipt_opened'
  | 'gc_verification_approved'
  | 'gc_correction_requested'
  | 'invite_created'
  | 'invite_redeemed'
  | 'foreman_invited'
  | 'subscription_created'
  | 'subscription_updated'
  | 'payment_failed';

// ─── Write Audit Entry ──────────────────────────────────────

/**
 * Writes an immutable audit log entry via service client (bypasses RLS).
 * MUST succeed — callers should treat failure as a transaction abort signal.
 *
 * Uses service client because:
 * 1. Audit writes must never be blocked by RLS (the audit itself IS the security layer)
 * 2. The changed_by field provides attribution regardless of RLS context
 */
export async function writeAuditEntry(params: {
  tableName: string;
  recordId: string;
  action: AuditAction;
  changedBy: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient();

  const { error } = await service.from('audit_log').insert({
    table_name: params.tableName,
    record_id: params.recordId,
    action: params.action,
    changed_by: params.changedBy,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    reason: params.reason ?? null,
  });

  if (error) {
    return { ok: false, error: `Audit write failed: ${error.message}` };
  }

  return { ok: true };
}
