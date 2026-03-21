import { createServiceClient } from '@/lib/supabase/service';
import { isValidHashFormat } from './hash';

export type VerifyResult =
  | { valid: true; generated_at: string; project_id: string }
  | { valid: false; reason: 'not_found' | 'invalid_format' };

/**
 * Verifies a SHA-256 hash against the legal_documents table.
 *
 * Used by:
 * - Public API endpoint: GET /api/legal/verify?hash=[hash]
 * - Evidence Package appendix: "Document Integrity Log"
 * - Arbitration: opposing counsel can verify document authenticity
 *
 * Uses service-role client to bypass RLS (endpoint is public).
 */
export async function verifyHash(hash: string): Promise<VerifyResult> {
  if (!isValidHashFormat(hash)) {
    return { valid: false, reason: 'invalid_format' };
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('legal_documents')
    .select('generated_at, project_id')
    .eq('sha256_hash', hash)
    .single();

  if (error || !data) {
    return { valid: false, reason: 'not_found' };
  }

  return {
    valid: true,
    generated_at: data.generated_at,
    project_id: data.project_id,
  };
}
