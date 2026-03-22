'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const GC_OVERRIDE_ROLES = new Set(['gc_admin', 'owner']);

type OverrideResult = {
  ok: boolean;
  error?: string;
};

/**
 * Applies a manual date override to a schedule item.
 * Manual override takes priority over calculated projection in the Forecast Engine.
 * Writes to audit_log for full traceability.
 */
export async function applyManualScheduleOverride(
  itemId: string,
  date: string,
  reason: string,
): Promise<OverrideResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  // Role check: only gc_admin or owner can override schedules
  if (!session.isDevBypass) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!user || !GC_OVERRIDE_ROLES.has(user.role)) {
      return { ok: false, error: 'Insufficient permissions — gc_admin or owner required' };
    }
  }

  // Fetch current state for audit
  const { data: current, error: fetchError } = await supabase
    .from('schedule_items')
    .select('manual_override_date, override_reason, planned_finish, baseline_finish')
    .eq('id', itemId)
    .single();

  if (fetchError || !current) {
    return { ok: false, error: 'Schedule item not found' };
  }

  // Apply override
  const { error: updateError } = await supabase
    .from('schedule_items')
    .update({
      manual_override_date: date,
      override_reason: reason,
      override_by: session.user.id,
      override_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Write audit log
  await supabase.from('audit_log').insert({
    table_name: 'schedule_items',
    record_id: itemId,
    action: 'manual_override',
    changed_by: session.user.id,
    old_value: {
      manual_override_date: current.manual_override_date,
      override_reason: current.override_reason,
    },
    new_value: {
      manual_override_date: date,
      override_reason: reason,
    },
    reason,
  });

  return { ok: true };
}

/**
 * Clears a manual override, reverting to calculated projection.
 */
export async function clearManualScheduleOverride(
  itemId: string,
  reason: string,
): Promise<OverrideResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  // Role check
  if (!session.isDevBypass) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!user || !GC_OVERRIDE_ROLES.has(user.role)) {
      return { ok: false, error: 'Insufficient permissions' };
    }
  }

  // Fetch current state for audit
  const { data: current } = await supabase
    .from('schedule_items')
    .select('manual_override_date, override_reason')
    .eq('id', itemId)
    .single();

  // Clear override
  const { error } = await supabase
    .from('schedule_items')
    .update({
      manual_override_date: null,
      override_reason: null,
      override_by: null,
      override_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) return { ok: false, error: error.message };

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'schedule_items',
    record_id: itemId,
    action: 'manual_override',
    changed_by: session.user.id,
    old_value: {
      manual_override_date: current?.manual_override_date,
      override_reason: current?.override_reason,
    },
    new_value: { manual_override_date: null, override_reason: null },
    reason: `Override cleared: ${reason}`,
  });

  return { ok: true };
}
