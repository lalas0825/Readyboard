'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';
import { refreshProjectForecast } from '@/features/forecast/services/forecastEngine';

// ─── Types ──────────────────────────────────────────

export type ConvertInput = {
  delayLogId: string;
  amount: number;
  description: string;
};

export type ChangeOrderRow = {
  id: string;
  delayLogId: string;
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type ConvertResult =
  | { ok: true; changeOrderId: string }
  | { ok: false; error: string };

export type ApproveResult =
  | { ok: true }
  | { ok: false; error: string };

export type RejectResult =
  | { ok: true }
  | { ok: false; error: string };

export type FinancialSummary = {
  totalDelayCost: number;
  totalChangeOrderAmount: number;
  totalFinancialImpact: number;
  changeOrders: ChangeOrderRow[];
};

// ─── Role Guard ─────────────────────────────────────

const GC_APPROVE_ROLES = new Set(['gc_admin', 'owner']);

// ─── Convert to Change Order ────────────────────────

/**
 * Converts a sent NOD into a financial change order.
 *
 * Requirements:
 * 1. delay_log must have legal_status = 'sent' (NOD must be sent first)
 * 2. delay_log must NOT already be a change order
 * 3. Amount must be > 0
 *
 * Atomicity: INSERT CO → UPDATE delay_log in sequence.
 * If delay_log UPDATE fails, we DELETE the orphaned CO.
 */
export async function convertToChangeOrder(
  input: ConvertInput,
): Promise<ConvertResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  if (input.amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero' };
  }

  // 1. Verify delay_log state
  const { data: log } = await supabase
    .from('delay_logs')
    .select(`
      id, legal_status, is_change_order, change_order_id,
      areas!inner ( project_id )
    `)
    .eq('id', input.delayLogId)
    .single();

  if (!log) return { ok: false, error: 'Delay log not found' };
  if (log.legal_status !== 'sent') {
    return { ok: false, error: `Cannot create CO: legal_status is '${log.legal_status}', must be 'sent'` };
  }
  if (log.is_change_order || log.change_order_id) {
    return { ok: false, error: 'Delay log already has a change order' };
  }

  const area = log.areas as unknown as { project_id: string };

  // 2. INSERT change order
  const { data: co, error: coError } = await supabase
    .from('change_orders')
    .insert({
      delay_log_id: input.delayLogId,
      project_id: area.project_id,
      amount: input.amount,
      description: input.description,
      status: 'pending',
      proposed_by: session.user.id,
    })
    .select('id')
    .single();

  if (coError || !co) {
    return { ok: false, error: `Change order creation failed: ${coError?.message ?? 'unknown'}` };
  }

  // 3. UPDATE delay_log to link CO (triggers immutability guard)
  const { error: linkError } = await supabase
    .from('delay_logs')
    .update({
      is_change_order: true,
      change_order_id: co.id,
    })
    .eq('id', input.delayLogId);

  if (linkError) {
    // Rollback: delete orphaned CO
    await supabase.from('change_orders').delete().eq('id', co.id);
    return { ok: false, error: `Failed to link CO to delay_log: ${linkError.message}` };
  }

  // Audit: CO created (atomicity — if audit fails, CO still exists but is logged)
  const audit = await writeAuditEntry({
    tableName: 'change_orders',
    recordId: co.id,
    action: 'change_order_created',
    changedBy: session.user.id,
    newValue: {
      delay_log_id: input.delayLogId,
      project_id: area.project_id,
      amount: input.amount,
      description: input.description,
      status: 'pending',
    },
    reason: `CO created from NOD on delay_log ${input.delayLogId}`,
  });

  if (!audit.ok) {
    // Rollback: CO without audit trail violates trazabilidad
    await supabase.from('delay_logs').update({ is_change_order: false, change_order_id: null }).eq('id', input.delayLogId);
    await supabase.from('change_orders').delete().eq('id', co.id);
    return { ok: false, error: audit.error };
  }

  return { ok: true, changeOrderId: co.id };
}

// ─── Approve Change Order ───────────────────────────

/**
 * GC admin/owner approves a pending change order.
 * Role check at service level — not just frontend.
 */
export async function approveChangeOrder(
  changeOrderId: string,
): Promise<ApproveResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  // Role gate: only gc_admin or owner
  if (!GC_APPROVE_ROLES.has(session.user.role)) {
    return { ok: false, error: `Role '${session.user.role}' cannot approve change orders` };
  }

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Verify current status + fetch linked data for scope_changes
  const { data: co } = await supabase
    .from('change_orders')
    .select('id, status, amount, project_id, delay_log_id, delay_logs!inner ( area_id, cumulative_cost )')
    .eq('id', changeOrderId)
    .single();

  if (!co) return { ok: false, error: 'Change order not found' };
  if (co.status !== 'pending') {
    return { ok: false, error: `Cannot approve: status is '${co.status}'` };
  }

  const { error } = await supabase
    .from('change_orders')
    .update({
      status: 'approved',
      approved_by: session.user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', changeOrderId);

  if (error) return { ok: false, error: error.message };

  // Audit: CO approved (atomic — must succeed)
  const audit = await writeAuditEntry({
    tableName: 'change_orders',
    recordId: changeOrderId,
    action: 'change_order_approved',
    changedBy: session.user.id,
    oldValue: { status: 'pending' },
    newValue: { status: 'approved', approved_by: session.user.id },
    reason: `CO $${Number(co.amount).toLocaleString()} approved`,
  });

  if (!audit.ok) {
    // Revert: approval without audit trail is not acceptable
    await supabase.from('change_orders').update({ status: 'pending', approved_by: null, approved_at: null }).eq('id', changeOrderId);
    return { ok: false, error: audit.error };
  }

  // F-1: Write scope_change + trigger forecast refresh
  const dl = co.delay_logs as unknown as { area_id: string; cumulative_cost: number };

  // Write scope_change to connect CO → Forecast pipeline
  await supabase.from('scope_changes').insert({
    area_id: dl.area_id,
    change_order_id: changeOrderId,
    delta_sqft: 0, // COs don't change sqft — they represent cost impact
    reason: `Change Order approved: $${Number(co.amount).toLocaleString()}`,
    initiated_by: session.user.id,
    forecast_impact_days: null, // Let forecast engine calculate
  });

  // Refresh forecast to reflect approved CO impact
  await refreshProjectForecast(co.project_id);

  return { ok: true };
}

// ─── Reject Change Order ────────────────────────────

/**
 * GC admin/owner rejects a change order, unlocking the delay_log.
 * Soft-delete: status → 'rejected', never hard-deleted.
 * Financial records are immutable — the rejection itself is evidence.
 */
export async function rejectChangeOrder(
  changeOrderId: string,
  rejectionReason?: string,
): Promise<RejectResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  if (!GC_APPROVE_ROLES.has(session.user.role)) {
    return { ok: false, error: `Role '${session.user.role}' cannot reject change orders` };
  }

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Verify current status
  const { data: co } = await supabase
    .from('change_orders')
    .select('id, status, delay_log_id, amount')
    .eq('id', changeOrderId)
    .single();

  if (!co) return { ok: false, error: 'Change order not found' };
  if (co.status !== 'pending') {
    return { ok: false, error: `Cannot reject: status is '${co.status}'` };
  }

  // 1. Soft-delete: mark as rejected (record preserved for audit)
  const { error: coError } = await supabase
    .from('change_orders')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: session.user.id,
      rejection_reason: rejectionReason ?? null,
    })
    .eq('id', changeOrderId);

  if (coError) return { ok: false, error: coError.message };

  // 2. Audit: CO rejected (atomic — must succeed)
  const audit = await writeAuditEntry({
    tableName: 'change_orders',
    recordId: changeOrderId,
    action: 'change_order_rejected',
    changedBy: session.user.id,
    oldValue: { status: 'pending', amount: Number(co.amount) },
    newValue: { status: 'rejected', rejected_by: session.user.id },
    reason: rejectionReason ?? 'No reason provided',
  });

  if (!audit.ok) {
    // Revert: rejection without audit trail is not acceptable
    await supabase.from('change_orders').update({ status: 'pending', rejected_at: null, rejected_by: null, rejection_reason: null }).eq('id', changeOrderId);
    return { ok: false, error: audit.error };
  }

  // 3. Unlock delay_log (via service client to bypass immutability trigger)
  const serviceClient = createServiceClient();
  const { error: resetError } = await serviceClient
    .from('delay_logs')
    .update({
      is_change_order: false,
      change_order_id: null,
    })
    .eq('id', co.delay_log_id);

  if (resetError) {
    return { ok: false, error: `CO rejected but delay_log unlock failed: ${resetError.message}` };
  }

  return { ok: true };
}

// ─── Financial Summary ──────────────────────────────

/**
 * Aggregates financial data for a project: total delay costs,
 * total approved CO amounts, and the combined financial impact.
 */
export async function getProjectFinancialSummary(
  projectId: string,
): Promise<FinancialSummary> {
  const session = await getSession();
  if (!session) {
    return { totalDelayCost: 0, totalChangeOrderAmount: 0, totalFinancialImpact: 0, changeOrders: [] };
  }

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Parallel: delay costs + change orders
  const [delayCostResult, coResult] = await Promise.all([
    supabase
      .from('delay_logs')
      .select('cumulative_cost, areas!inner ( project_id )')
      .eq('areas.project_id', projectId),
    supabase
      .from('change_orders')
      .select('id, delay_log_id, amount, description, status, proposed_by, approved_by, approved_at, created_at')
      .eq('project_id', projectId)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false }),
  ]);

  const totalDelayCost = (delayCostResult.data ?? []).reduce(
    (sum, d) => sum + Number(d.cumulative_cost ?? 0),
    0,
  );

  const changeOrders: ChangeOrderRow[] = (coResult.data ?? []).map((co) => ({
    id: co.id,
    delayLogId: co.delay_log_id,
    amount: Number(co.amount),
    description: co.description,
    status: co.status as 'pending' | 'approved' | 'rejected',
    proposedBy: co.proposed_by,
    approvedBy: co.approved_by,
    approvedAt: co.approved_at,
    createdAt: co.created_at,
  }));

  const totalChangeOrderAmount = changeOrders
    .filter((co) => co.status === 'approved')
    .reduce((sum, co) => sum + co.amount, 0);

  return {
    totalDelayCost: Math.round(totalDelayCost * 100) / 100,
    totalChangeOrderAmount: Math.round(totalChangeOrderAmount * 100) / 100,
    totalFinancialImpact: Math.round((totalDelayCost + totalChangeOrderAmount) * 100) / 100,
    changeOrders,
  };
}
