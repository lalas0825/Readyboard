'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

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

  // Verify current status
  const { data: co } = await supabase
    .from('change_orders')
    .select('id, status')
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
  return { ok: true };
}

// ─── Reject Change Order ────────────────────────────

/**
 * GC admin/owner rejects a change order, unlocking the delay_log.
 * Role check at service level.
 */
export async function rejectChangeOrder(
  changeOrderId: string,
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
    .select('id, status, delay_log_id')
    .eq('id', changeOrderId)
    .single();

  if (!co) return { ok: false, error: 'Change order not found' };
  if (co.status !== 'pending') {
    return { ok: false, error: `Cannot reject: status is '${co.status}'` };
  }

  // 1. Update CO status
  const { error: coError } = await supabase
    .from('change_orders')
    .update({ status: 'rejected' })
    .eq('id', changeOrderId);

  if (coError) return { ok: false, error: coError.message };

  // 2. Unlock delay_log (remove CO link)
  // Note: the immutability guard allows this only because we update
  // via service role — the trigger checks is_change_order on OLD row
  // and blocks, so we need to use a function or bypass.
  // For V1, rejection deletes the CO record to cleanly unlock.
  const { error: deleteError } = await supabase
    .from('change_orders')
    .delete()
    .eq('id', changeOrderId);

  if (deleteError) {
    return { ok: false, error: `CO rejected but cleanup failed: ${deleteError.message}` };
  }

  // Reset delay_log flags (trigger allows this because is_change_order
  // references the OLD row value — after CO deletion, a separate
  // manual reset via service client is needed)
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
