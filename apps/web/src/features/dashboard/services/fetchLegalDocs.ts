'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { LegalDoc } from '../types';

/**
 * Fetches legal documents for a project.
 * RLS enforces visibility: GC sees only published_to_gc = true,
 * Sub sees all docs belonging to their org.
 */
export async function fetchLegalDocs(projectId: string): Promise<LegalDoc[]> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('legal_documents')
    .select('id, type, sha256_hash, published_to_gc, published_at, sent_at, pdf_url, open_count, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    type: d.type as LegalDoc['type'],
    sha256Hash: d.sha256_hash,
    publishedToGc: d.published_to_gc ?? false,
    publishedAt: d.published_at,
    sentAt: d.sent_at,
    pdfUrl: d.pdf_url,
    openCount: d.open_count ?? 0,
    createdAt: d.created_at,
  }));
}
