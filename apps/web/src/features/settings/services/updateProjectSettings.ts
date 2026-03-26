'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';

type UpdateInput = {
  projectId: string;
  name?: string;
  address?: string;
  laborRate?: number;
  jurisdiction?: string;
  safetyGateEnabled?: boolean;
};

export async function updateProjectSettings(
  input: UpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  // Role check: gc_admin, gc_pm, owner
  const role = session.user.role;
  if (!['gc_admin', 'gc_pm', 'owner'].includes(role) && !session.isDevBypass) {
    return { ok: false, error: 'Only GC Admin, PM, or Owner can update project settings' };
  }

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Fetch current for audit diff — scoped to user's org for security
  const { data: current } = await supabase
    .from('projects')
    .select('name, address, labor_rate_per_hour, legal_jurisdiction, safety_gate_enabled, gc_org_id')
    .eq('id', input.projectId)
    .single();

  if (!current) return { ok: false, error: 'Project not found' };

  // Org ownership check: user must belong to the project's GC org
  if (!session.isDevBypass && current.gc_org_id !== session.user.org_id) {
    return { ok: false, error: 'Not authorized — project belongs to a different organization' };
  }

  // Build update object (only changed fields)
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined && input.name !== current.name) updates.name = input.name;
  if (input.address !== undefined && input.address !== current.address) updates.address = input.address;
  if (input.laborRate !== undefined && input.laborRate !== Number(current.labor_rate_per_hour)) updates.labor_rate_per_hour = input.laborRate;
  if (input.jurisdiction !== undefined && input.jurisdiction !== current.legal_jurisdiction) updates.legal_jurisdiction = input.jurisdiction;
  if (input.safetyGateEnabled !== undefined && input.safetyGateEnabled !== current.safety_gate_enabled) updates.safety_gate_enabled = input.safetyGateEnabled;

  if (Object.keys(updates).length === 0) {
    return { ok: true }; // No changes
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', input.projectId);

  if (error) return { ok: false, error: error.message };

  // Audit
  await writeAuditEntry({
    tableName: 'projects',
    recordId: input.projectId,
    action: 'config_change',
    changedBy: session.user.id,
    oldValue: current as Record<string, unknown>,
    newValue: updates,
    reason: 'Project settings updated',
  });

  return { ok: true };
}
