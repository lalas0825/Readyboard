'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';

/**
 * Server action: marks a corrective action as acknowledged.
 * Validates: session exists, CA is currently open, caller is GC role or assigned user.
 * Writes audit entry: `ca_acknowledged`.
 */
export async function acknowledgeCA(
  actionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Fetch current state
  const { data: ca, error: fetchErr } = await supabase
    .from('corrective_actions')
    .select('id, assigned_to, acknowledged_at, resolved_at')
    .eq('id', actionId)
    .single();

  if (fetchErr || !ca) return { ok: false, error: 'Corrective action not found' };

  // Guard: already acknowledged or resolved
  if (ca.acknowledged_at) return { ok: false, error: 'Already acknowledged' };
  if (ca.resolved_at) return { ok: false, error: 'Already resolved' };

  // Guard: must be assigned user or GC role
  const role = session.user.role;
  const isGC = role === 'gc_admin' || role === 'gc_pm' || role === 'gc_super' || role === 'owner';
  const isAssigned = ca.assigned_to === session.user.id;

  if (!isGC && !isAssigned) {
    return { ok: false, error: 'Not authorized — must be assigned user or GC role' };
  }

  // Update
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('corrective_actions')
    .update({ acknowledged_at: now })
    .eq('id', actionId);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit (service client — bypasses RLS)
  await writeAuditEntry({
    tableName: 'corrective_actions',
    recordId: actionId,
    action: 'ca_acknowledged',
    changedBy: session.user.id,
    oldValue: { acknowledged_at: null },
    newValue: { acknowledged_at: now },
    reason: `Acknowledged by ${session.user.id}`,
  });

  return { ok: true };
}
