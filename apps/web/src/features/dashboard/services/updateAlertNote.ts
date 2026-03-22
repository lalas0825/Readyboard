'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

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
  return { ok: true };
}
