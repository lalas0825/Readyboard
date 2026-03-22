'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';
import type { CorrectiveActionData } from '../types';
import { deriveActionStatus } from '../lib/deriveActionStatus';

type CreateCorrectiveActionInput = {
  delay_log_id: string;
  assigned_to: string;
  deadline: string; // ISO string
  note: string;
};

/**
 * Server action: atomically creates a corrective action + notification.
 * Uses session user as created_by when authenticated, falls back to seed gc_pm in dev.
 */
export async function createCorrectiveAction(
  input: CreateCorrectiveActionInput,
): Promise<{ ok: true; data: CorrectiveActionData } | { ok: false; error: string }> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Use session user as created_by, or fall back to seed gc_pm (dev only)
  let createdById = session?.user.id;
  if (!createdById && process.env.NODE_ENV === 'development') {
    const service = createServiceClient();
    const { data: gcUser } = await service
      .from('users')
      .select('id')
      .eq('role', 'gc_pm')
      .limit(1)
      .single();
    createdById = gcUser?.id;
  }

  if (!createdById) {
    return { ok: false, error: 'No authenticated user and no GC PM seed user found.' };
  }

  const { data: inserted, error } = await supabase
    .from('corrective_actions')
    .insert({
      delay_log_id: input.delay_log_id,
      assigned_to: input.assigned_to,
      deadline: input.deadline,
      note: input.note || null,
      created_by: createdById,
    })
    .select(`
      id,
      delay_log_id,
      assigned_to,
      deadline,
      note,
      created_by,
      created_at,
      acknowledged_at,
      in_resolution_at,
      resolved_at,
      users!corrective_actions_assigned_to_fkey ( name ),
      delay_logs!inner ( area_id, trade_name )
    `)
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? 'Insert failed' };
  }

  // Fire-and-forget notification — failure here does NOT fail the corrective action
  void supabase.from('notifications').insert({
    user_id: input.assigned_to,
    type: 'corrective_action_assigned',
    title: 'Nueva Acción Correctiva Asignada',
    body: input.note || 'Se te ha asignado una acción correctiva.',
    data: { corrective_action_id: inserted.id, delay_log_id: input.delay_log_id },
  });

  // Audit: CA created
  await writeAuditEntry({
    tableName: 'corrective_actions',
    recordId: inserted.id as string,
    action: 'ca_created',
    changedBy: createdById,
    newValue: {
      delay_log_id: input.delay_log_id,
      assigned_to: input.assigned_to,
      deadline: input.deadline,
      note: input.note || null,
    },
    reason: `Corrective action assigned to ${input.assigned_to}`,
  });

  const dl = inserted.delay_logs as unknown as Record<string, unknown>;
  const u = inserted.users as unknown as Record<string, unknown>;

  return {
    ok: true,
    data: {
      id: inserted.id as string,
      delay_log_id: inserted.delay_log_id as string,
      area_id: dl.area_id as string,
      trade_name: dl.trade_name as string,
      assigned_to: inserted.assigned_to as string,
      assigned_to_name: (u?.name as string) ?? 'Unknown',
      deadline: inserted.deadline as string,
      note: inserted.note as string | null,
      created_by: inserted.created_by as string,
      created_at: inserted.created_at as string,
      status: deriveActionStatus({
        resolved_at: inserted.resolved_at as string | null,
        in_resolution_at: inserted.in_resolution_at as string | null,
        acknowledged_at: inserted.acknowledged_at as string | null,
      }),
    },
  };
}
