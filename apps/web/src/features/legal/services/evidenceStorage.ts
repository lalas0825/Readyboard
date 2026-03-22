'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Types ──────────────────────────────────────────

export type SignatureInput = {
  /** PNG image as base64 data URL (data:image/png;base64,...) */
  imageBase64: string;
  /** Audit metadata — device info, timestamp, coordinate path */
  metadata: {
    capturedAt: string;
    deviceInfo: string;
    canvasWidth: number;
    canvasHeight: number;
    strokeCount: number;
    totalPoints: number;
    coordPath: number[][][];
  };
};

export type UploadEvidenceResult =
  | { ok: true; path: string; hash: string; signaturePath: string | null }
  | { ok: false; error: string };

export type EvidenceInfo = {
  delayLogId: string;
  path: string;
  hash: string;
  signedUrl: string | null;
  signaturePath: string | null;
};

// ─── Constants ──────────────────────────────────────

const BUCKET = 'legal-docs';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

// ─── Service ────────────────────────────────────────

/**
 * Computes SHA-256 hash of file content.
 * Runs server-side using Web Crypto API (available in Node 18+).
 */
async function computeHash(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a base64 data URL to an ArrayBuffer.
 */
function base64ToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Builds storage paths for a delay_log's evidence package.
 */
function buildPaths(projectId: string, delayLogId: string) {
  const base = `${projectId}/${delayLogId}`;
  return {
    evidence: `${base}/evidence.pdf`,
    signature: `${base}/signature.png`,
    audit: `${base}/audit.json`,
  };
}

/**
 * Uploads a legal evidence PDF for a delay_log, with optional signature.
 *
 * Requirements enforced:
 * 1. User must be authenticated
 * 2. delay_log must exist and have legal_status = 'draft' (or sent/signed for re-sign flows)
 * 3. No existing evidence for this delay_log (no overwrites)
 * 4. SHA-256 hash is computed before upload and stored in DB
 * 5. If signature provided: PNG + audit JSON are stored alongside the PDF
 *
 * The hash enables future tamper-evident verification:
 * download the file, recompute hash, compare against DB value.
 */
export async function uploadEvidence(
  delayLogId: string,
  fileContent: ArrayBuffer,
  signature?: SignatureInput,
): Promise<UploadEvidenceResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // 1. Verify delay_log exists and is in the correct state
  const { data: log } = await supabase
    .from('delay_logs')
    .select(`
      id, legal_status, evidence_hash, evidence_path,
      area_id, trade_name, reason_code, crew_size,
      started_at, ended_at, man_hours, daily_cost, cumulative_cost,
      areas!inner ( project_id, name, floor )
    `)
    .eq('id', delayLogId)
    .single();

  if (!log) return { ok: false, error: 'Delay log not found' };

  const legalStatus = log.legal_status as string | null;
  if (!legalStatus || legalStatus === 'pending') {
    return {
      ok: false,
      error: `Cannot upload evidence: delay_log status is '${legalStatus ?? 'null'}'. Must be draft or later.`,
    };
  }

  // 2. Check for existing evidence (no overwrites)
  if (log.evidence_hash || log.evidence_path) {
    return {
      ok: false,
      error: 'Evidence already exists for this delay log. Documents are immutable.',
    };
  }

  const area = log.areas as unknown as Record<string, unknown>;
  const projectId = area.project_id as string;
  const paths = buildPaths(projectId, delayLogId);

  // 3. Compute SHA-256 hash of the PDF before upload
  const hash = await computeHash(fileContent);

  // 4. Upload PDF to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(paths.evidence, fileContent, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  let signaturePath: string | null = null;

  // 5. If signature provided, upload PNG + audit JSON
  if (signature) {
    // Upload signature PNG
    const sigBuffer = base64ToArrayBuffer(signature.imageBase64);
    const { error: sigError } = await supabase.storage
      .from(BUCKET)
      .upload(paths.signature, sigBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (sigError) {
      return { ok: false, error: `Signature upload failed: ${sigError.message}` };
    }
    signaturePath = paths.signature;

    // Build and upload audit JSON (signature metadata + delay context)
    const auditPayload = {
      delayLogId,
      evidenceHash: hash,
      signature: {
        capturedAt: signature.metadata.capturedAt,
        deviceInfo: signature.metadata.deviceInfo,
        canvasWidth: signature.metadata.canvasWidth,
        canvasHeight: signature.metadata.canvasHeight,
        strokeCount: signature.metadata.strokeCount,
        totalPoints: signature.metadata.totalPoints,
        coordPath: signature.metadata.coordPath,
      },
      delayContext: {
        areaName: area.name,
        floor: area.floor,
        tradeName: log.trade_name,
        reasonCode: log.reason_code,
        crewSize: log.crew_size,
        startedAt: log.started_at,
        endedAt: log.ended_at,
        manHours: log.man_hours,
        dailyCost: log.daily_cost,
        cumulativeCost: log.cumulative_cost,
      },
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.user.id,
    };

    const auditBuffer = new TextEncoder().encode(JSON.stringify(auditPayload, null, 2));
    await supabase.storage
      .from(BUCKET)
      .upload(paths.audit, auditBuffer, {
        contentType: 'application/json',
        upsert: false,
      });
  }

  // 6. Save hash and path in delay_log (immutable after this write)
  const { error: updateError } = await supabase
    .from('delay_logs')
    .update({
      evidence_path: paths.evidence,
      evidence_hash: hash,
    })
    .eq('id', delayLogId);

  if (updateError) {
    return { ok: false, error: `Failed to save evidence metadata: ${updateError.message}` };
  }

  return { ok: true, path: paths.evidence, hash, signaturePath };
}

/**
 * Retrieves evidence info + signed download URL for a delay_log.
 * Returns null if no evidence exists.
 */
export async function getEvidenceInfo(
  delayLogId: string,
): Promise<EvidenceInfo | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data: log } = await supabase
    .from('delay_logs')
    .select(`
      id, evidence_path, evidence_hash,
      areas!inner ( project_id )
    `)
    .eq('id', delayLogId)
    .single();

  if (!log?.evidence_path || !log?.evidence_hash) return null;

  // Generate signed URL for download (1 hour expiry)
  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(log.evidence_path, SIGNED_URL_EXPIRY);

  // Check if signature exists
  const area = log.areas as unknown as Record<string, unknown>;
  const projectId = area.project_id as string;
  const sigPath = `${projectId}/${delayLogId}/signature.png`;
  const { data: sigList } = await supabase.storage
    .from(BUCKET)
    .list(`${projectId}/${delayLogId}`, { search: 'signature.png' });

  const hasSignature = (sigList?.length ?? 0) > 0;

  return {
    delayLogId: log.id,
    path: log.evidence_path,
    hash: log.evidence_hash,
    signedUrl: signedData?.signedUrl ?? null,
    signaturePath: hasSignature ? sigPath : null,
  };
}

/**
 * Verifies the integrity of an uploaded evidence document.
 * Downloads the file, recomputes SHA-256, and compares against stored hash.
 */
export async function verifyEvidenceIntegrity(
  delayLogId: string,
): Promise<{ ok: true; verified: boolean; storedHash: string; computedHash: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data: log } = await supabase
    .from('delay_logs')
    .select('evidence_path, evidence_hash')
    .eq('id', delayLogId)
    .single();

  if (!log?.evidence_path || !log?.evidence_hash) {
    return { ok: false, error: 'No evidence found for this delay log' };
  }

  // Download the file
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(log.evidence_path);

  if (downloadError || !fileData) {
    return { ok: false, error: `Download failed: ${downloadError?.message ?? 'unknown'}` };
  }

  // Recompute hash
  const content = await fileData.arrayBuffer();
  const computedHash = await computeHash(content);

  return {
    ok: true,
    verified: computedHash === log.evidence_hash,
    storedHash: log.evidence_hash,
    computedHash,
  };
}
