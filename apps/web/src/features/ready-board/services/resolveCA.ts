'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';

/**
 * Server action: marks a corrective action as resolved.
 * Validates: session exists, CA is acknowledged (not still open), caller is GC role.
 * Writes audit entry: `ca_resolved`.
 * The DB trigger `close_delay_on_ca_resolved` handles closing the linked delay_log.
 */
export async function resolveCA(
  actionId: string,
  resolution?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Fetch current state
  const { data: ca, error: fetchErr } = await supabase
    .from('corrective_actions')
    .select('id, assigned_to, acknowledged_at, in_resolution_at, resolved_at')
    .eq('id', actionId)
    .single();

  if (fetchErr || !ca) return { ok: false, error: 'Corrective action not found' };

  // Guard: already resolved
  if (ca.resolved_at) return { ok: false, error: 'Already resolved' };

  // Guard: must be acknowledged first
  if (!ca.acknowledged_at) return { ok: false, error: 'Must be acknowledged before resolving' };

  // Guard: GC role required for resolution
  const role = session.user.role;
  const isGC = role === 'gc_admin' || role === 'gc_pm' || role === 'gc_super' || role === 'owner';

  if (!isGC) {
    return { ok: false, error: 'Not authorized — only GC roles can resolve' };
  }

  // Update
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('corrective_actions')
    .update({ resolved_at: now })
    .eq('id', actionId);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit (service client — bypasses RLS)
  await writeAuditEntry({
    tableName: 'corrective_actions',
    recordId: actionId,
    action: 'ca_resolved',
    changedBy: session.user.id,
    oldValue: { resolved_at: null },
    newValue: { resolved_at: now, resolution: resolution ?? null },
    reason: resolution ?? 'Corrective action resolved',
  });

  return { ok: true };
}
