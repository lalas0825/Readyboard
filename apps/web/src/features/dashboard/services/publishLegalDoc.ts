'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Publishes a legal document to the GC.
 * Sets published_to_gc = true and published_at = NOW().
 * After this, the GC can see the document (RLS enforced).
 */
export async function publishLegalDoc(
  docId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { error } = await supabase
    .from('legal_documents')
    .update({
      published_to_gc: true,
      published_at: new Date().toISOString(),
    })
    .eq('id', docId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
