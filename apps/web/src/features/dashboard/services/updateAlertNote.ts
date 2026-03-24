'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';

/**
 * Updates the note on a corrective action.
 * The note field already exists in the corrective_actions schema.
 */
export async function updateAlertNote(
  correctiveActionId: string,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { error } = await supabase
    .from('corrective_actions')
    .update({ note })
    .eq('id', correctiveActionId);

  if (error) return { ok: false, error: error.message };

  // Audit: note change must leave a trace
  if (session) {
    await writeAuditEntry({
      tableName: 'corrective_actions',
      recordId: correctiveActionId,
      action: 'status_change',
      changedBy: session.user.id,
      newValue: { note },
      reason: 'Note updated on corrective action',
    });
  }

  return { ok: true };
}
