'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { LegalDocType } from '../types';

/**
 * Creates a new legal document draft (NOD, REA, or Evidence).
 * The document starts unpublished with no PDF — content is generated later.
 */
export async function createLegalDoc(input: {
  projectId: string;
  type: LegalDocType;
}): Promise<{ ok: true; docId: string; createdAt: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('legal_documents')
    .insert({
      project_id: input.projectId,
      org_id: session.user.org_id,
      type: input.type,
    })
    .select('id, created_at')
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, docId: data.id, createdAt: data.created_at };
}
