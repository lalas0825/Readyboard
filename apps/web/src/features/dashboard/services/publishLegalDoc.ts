'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';

/**
 * Publishes a legal document to the GC.
 * Sets published_to_gc = true and published_at = NOW().
 * After this, the GC can see the document (RLS enforced).
 */
export async function publishLegalDoc(
  docId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
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

  // Audit: legal doc published to GC (critical — creates GC visibility)
  const audit = await writeAuditEntry({
    tableName: 'legal_documents',
    recordId: docId,
    action: 'legal_doc_published',
    changedBy: session.user.id,
    oldValue: { published_to_gc: false },
    newValue: { published_to_gc: true },
    reason: 'Legal document published to GC',
  });

  if (!audit.ok) {
    // Revert: publication without audit = unacceptable
    await supabase.from('legal_documents').update({ published_to_gc: false, published_at: null }).eq('id', docId);
    return { ok: false, error: audit.error };
  }

  return { ok: true };
}
