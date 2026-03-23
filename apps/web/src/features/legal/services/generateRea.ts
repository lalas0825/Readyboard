'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';
import { buildReaPdf } from './reaBuilder';
import type { ReaDelayItem, ReaNodReference, ReaContext } from './reaBuilder';
import type { SignatureInput } from './evidenceStorage';
import type { PdfLocale } from './pdfTexts';
import { computePdfHash } from './pdfHelpers';

// ─── Types ──────────────────────────────────────────

export type GenerateReaInput = {
  projectId: string;
  delayLogIds: string[];
  signature: SignatureInput;
  locale?: PdfLocale;
  overheadMultiplier?: number; // default 1.15
};

export type GenerateReaResult =
  | { ok: true; docId: string; hash: string; totalClaim: number }
  | { ok: false; error: string };

// ─── Constants ──────────────────────────────────────

const BUCKET = 'legal-docs';
const DEFAULT_OVERHEAD = 1.15;

// ─── Generate REA ───────────────────────────────────

/**
 * Generates a Request for Equitable Adjustment aggregating multiple delay_logs.
 *
 * Flow:
 * 1. Validate all delay_logs belong to same project + have legal_status >= 'sent'
 * 2. Fetch related NODs for each delay
 * 3. Calculate total claim (sum of cumulative_cost × overhead multiplier)
 * 4. Build PDF with SHA-256 hash in footer
 * 5. Upload to legal-docs bucket
 * 6. Create legal_documents record + rea_delay_links
 * 7. Link delay_logs via rea_id
 * 8. Audit entry — revert on failure
 */
export async function generateRea(
  input: GenerateReaInput,
): Promise<GenerateReaResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  if (input.delayLogIds.length === 0) {
    return { ok: false, error: 'At least one delay log is required' };
  }

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const overheadMultiplier = input.overheadMultiplier ?? DEFAULT_OVERHEAD;
  const locale = input.locale ?? 'en';

  // ── 1. Fetch and validate delay logs ──────────────

  const { data: delays, error: delaysError } = await supabase
    .from('delay_logs')
    .select(`
      id, trade_name, reason_code, crew_size,
      started_at, ended_at, man_hours, daily_cost, cumulative_cost,
      legal_status, rea_id,
      areas!inner (
        id, name, floor, project_id,
        projects!inner (
          id, name, address, legal_jurisdiction, labor_rate_per_hour,
          gc_org:organizations!projects_gc_org_id_fkey ( id, name )
        )
      )
    `)
    .in('id', input.delayLogIds);

  if (delaysError || !delays || delays.length === 0) {
    return { ok: false, error: `Failed to fetch delay logs: ${delaysError?.message ?? 'not found'}` };
  }

  // Validate: all delays belong to the specified project
  for (const d of delays) {
    const area = d.areas as unknown as Record<string, unknown>;
    const project = area.projects as unknown as Record<string, unknown>;
    if ((project.id as string) !== input.projectId) {
      return { ok: false, error: `Delay log ${d.id} belongs to a different project` };
    }
  }

  // Validate: all delays have legal_status >= 'sent' (NOD was sent)
  const validStatuses = ['sent', 'signed'];
  for (const d of delays) {
    if (!d.legal_status || !validStatuses.includes(d.legal_status)) {
      return {
        ok: false,
        error: `Delay log ${d.id} has status '${d.legal_status ?? 'null'}'. All delays must have NOD sent before REA.`,
      };
    }
  }

  // Validate: no delay already linked to an REA
  for (const d of delays) {
    if (d.rea_id) {
      return { ok: false, error: `Delay log ${d.id} is already linked to an REA` };
    }
  }

  // ── 2. Extract project context from first delay ───

  const firstArea = delays[0].areas as unknown as Record<string, unknown>;
  const project = firstArea.projects as unknown as Record<string, unknown>;
  const gcOrg = project.gc_org as unknown as Record<string, unknown>;

  // ── 3. Fetch related NODs ─────────────────────────

  const nodDraftIds = delays
    .map((d) => (d as unknown as Record<string, unknown>).nod_draft_id as string | null)
    .filter(Boolean) as string[];

  let relatedNods: ReaNodReference[] = [];
  if (nodDraftIds.length > 0) {
    const { data: nods } = await supabase
      .from('nod_drafts')
      .select(`
        id, sent_at, delay_log_id,
        delay_logs!inner (
          evidence_hash,
          areas!inner ( name ),
          trade_name
        )
      `)
      .in('id', nodDraftIds)
      .not('sent_at', 'is', null);

    if (nods) {
      relatedNods = nods.map((n) => {
        const dl = n.delay_logs as unknown as Record<string, unknown>;
        const area = dl.areas as unknown as Record<string, unknown>;
        return {
          id: n.id,
          sentAt: n.sent_at!,
          sha256Hash: (dl.evidence_hash as string) ?? null,
          areaName: (area.name as string) ?? 'Unknown',
          tradeName: (dl.trade_name as string) ?? 'Unknown',
        };
      });
    }
  }

  // ── 4. Build delay items + calculate total ────────

  const delayItems: ReaDelayItem[] = delays.map((d) => {
    const area = d.areas as unknown as Record<string, unknown>;
    return {
      id: d.id,
      areaName: (area.name as string) ?? 'Unknown',
      floor: (area.floor as string) ?? '?',
      tradeName: d.trade_name,
      reasonCode: d.reason_code,
      crewSize: d.crew_size ?? 1,
      startedAt: d.started_at,
      endedAt: d.ended_at,
      manHours: Number(d.man_hours),
      dailyCost: Number(d.daily_cost),
      cumulativeCost: Number(d.cumulative_cost),
    };
  });

  const subtotal = delayItems.reduce((sum, d) => sum + d.cumulativeCost, 0);
  const totalClaimAmount = Math.round(subtotal * overheadMultiplier * 100) / 100;

  // ── 5. Create legal_documents record first (need ID for PDF) ──

  const { data: legalDoc, error: insertError } = await supabase
    .from('legal_documents')
    .insert({
      project_id: input.projectId,
      org_id: session.user.org_id,
      type: 'rea',
      total_claim_amount: totalClaimAmount,
      locale,
      sent_at: new Date().toISOString(),
      sent_by: session.user.id,
      generated_at: new Date().toISOString(),
    })
    .select('id, receipt_tracking_uuid')
    .single();

  if (insertError || !legalDoc) {
    return { ok: false, error: `Failed to create legal document: ${insertError?.message ?? 'unknown'}` };
  }

  const documentId = legalDoc.id;

  // ── 6. Build REA PDF ──────────────────────────────

  const reaCtx: ReaContext = {
    project: {
      name: (project.name as string) ?? 'Unknown Project',
      address: (project.address as string) ?? '',
      jurisdiction: (project.legal_jurisdiction as string) ?? '',
      laborRate: Number(project.labor_rate_per_hour ?? 0),
    },
    org: {
      name: (gcOrg?.name as string) ?? 'Unknown Organization',
    },
    user: {
      name: session.user.name,
    },
    delays: delayItems,
    relatedNods,
    overheadMultiplier,
    totalClaimAmount,
    documentId,
  };

  const pdfBytes = await buildReaPdf(reaCtx, {
    signature: input.signature,
    locale,
  });

  // Compute hash
  const hash = await computePdfHash(pdfBytes);

  // ── 7. Upload PDF + signature to storage ──────────

  const pdfPath = `${input.projectId}/rea/${documentId}/rea.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    // Cleanup: delete the legal_documents record
    await supabase.from('legal_documents').delete().eq('id', documentId);
    return { ok: false, error: `PDF upload failed: ${uploadError.message}` };
  }

  // Upload signature PNG
  let signaturePath: string | null = null;
  if (input.signature) {
    const base64 = input.signature.imageBase64.split(',')[1];
    const binary = atob(base64);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const sigPath = `${input.projectId}/rea/${documentId}/signature.png`;
    const { error: sigError } = await supabase.storage
      .from(BUCKET)
      .upload(sigPath, sigBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (!sigError) {
      signaturePath = sigPath;
    }
  }

  // ── 8. Update legal_documents with hash + paths ───

  const { error: updateDocError } = await supabase
    .from('legal_documents')
    .update({
      sha256_hash: hash,
      pdf_url: pdfPath,
      signature_png_url: signaturePath,
    })
    .eq('id', documentId);

  if (updateDocError) {
    return { ok: false, error: `PDF uploaded but document update failed: ${updateDocError.message}` };
  }

  // ── 9. Create rea_delay_links ─────────────────────

  const links = delayItems.map((d) => ({
    legal_document_id: documentId,
    delay_log_id: d.id,
    man_hours: d.manHours,
    cost_amount: d.cumulativeCost,
  }));

  const { error: linksError } = await supabase
    .from('rea_delay_links')
    .insert(links);

  if (linksError) {
    return { ok: false, error: `Failed to create REA-delay links: ${linksError.message}` };
  }

  // ── 10. Update delay_logs.rea_id ──────────────────

  const { error: reaLinkError } = await supabase
    .from('delay_logs')
    .update({ rea_id: documentId })
    .in('id', input.delayLogIds);

  if (reaLinkError) {
    return { ok: false, error: `Failed to link delay logs to REA: ${reaLinkError.message}` };
  }

  // ── 11. Audit entry (atomic — revert on failure) ──

  const audit = await writeAuditEntry({
    tableName: 'legal_documents',
    recordId: documentId,
    action: 'rea_generated',
    changedBy: session.user.id,
    oldValue: null,
    newValue: {
      type: 'rea',
      total_claim_amount: totalClaimAmount,
      delay_count: input.delayLogIds.length,
      sha256: hash,
      overhead_multiplier: overheadMultiplier,
    },
    reason: `REA generated — ${delayItems.length} delays, total claim ${totalClaimAmount.toFixed(2)}, SHA-256: ${hash}`,
  });

  if (!audit.ok) {
    // Audit failed → revert: unlink delays, delete links, delete document
    await supabase.from('delay_logs').update({ rea_id: null }).in('id', input.delayLogIds);
    await supabase.from('rea_delay_links').delete().eq('legal_document_id', documentId);
    await supabase.from('legal_documents').delete().eq('id', documentId);
    return { ok: false, error: audit.error };
  }

  return { ok: true, docId: documentId, hash, totalClaim: totalClaimAmount };
}
