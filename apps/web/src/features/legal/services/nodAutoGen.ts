'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchDelayContext, buildPdf } from './pdfAssembler';
import { uploadEvidence } from './evidenceStorage';
import type { SignatureInput } from './evidenceStorage';
import { writeAuditEntry } from '@/lib/audit';

// ─── Types ──────────────────────────────────────────

export type GenerateDraftResult =
  | { ok: true; nodDraftId: string; draftPath: string }
  | { ok: false; error: string };

export type ApproveNodResult =
  | { ok: true; path: string; hash: string; signaturePath: string }
  | { ok: false; error: string };

export type NodDraftContent = {
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  crewSize: number;
  manHours: number;
  dailyCost: number;
  cumulativeCost: number;
  startedAt: string;
  endedAt: string | null;
  projectName: string;
  projectAddress: string;
  jurisdiction: string;
  laborRate: number;
  generatedAt: string;
};

// ─── Generate Draft NOD ─────────────────────────────

/**
 * Auto-generates a draft NOD PDF when a delay crosses the threshold.
 * Called by thresholdEngine.scanThresholds() after marking a log as 'pending'.
 *
 * Flow: pending → generate PDF → upload to /drafts/ → create nod_draft → advance to 'draft'
 *
 * Reconciliation pattern: DB status only advances if the file
 * in the bucket is verified via upload success.
 */
export async function generateNodDraft(
  delayLogId: string,
): Promise<GenerateDraftResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // 1. Fetch delay context (allow 'pending' status for draft generation)
  const context = await fetchDelayContext(supabase, delayLogId, session.user, ['pending']);
  if (!context.ok) return { ok: false, error: context.error };

  const ctx = context.data;

  // 2. Generate draft PDF (no signature, watermark)
  const pdfBytes = await buildPdf(ctx, { isDraft: true });

  // 3. Upload draft to /drafts/ path in legal-docs bucket
  const projectId = await getProjectIdForDelay(supabase, delayLogId);
  if (!projectId) return { ok: false, error: 'Could not resolve project_id for delay_log' };

  const draftPath = `${projectId}/${delayLogId}/drafts/nod_draft.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('legal-docs')
    .upload(draftPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true, // Drafts can be regenerated
    });

  if (uploadError) {
    return { ok: false, error: `Draft upload failed: ${uploadError.message}` };
  }

  // 4. Build draft content JSONB
  const draftContent: NodDraftContent = {
    areaName: ctx.area.name,
    floor: ctx.area.floor,
    tradeName: ctx.delay.tradeName,
    reasonCode: ctx.delay.reasonCode,
    crewSize: ctx.delay.crewSize,
    manHours: ctx.delay.manHours,
    dailyCost: ctx.delay.dailyCost,
    cumulativeCost: ctx.delay.cumulativeCost,
    startedAt: ctx.delay.startedAt,
    endedAt: ctx.delay.endedAt,
    projectName: ctx.project.name,
    projectAddress: ctx.project.address,
    jurisdiction: ctx.project.jurisdiction,
    laborRate: ctx.project.laborRate,
    generatedAt: new Date().toISOString(),
  };

  // 5. Upsert nod_draft record
  const { data: nodDraft, error: draftError } = await supabase
    .from('nod_drafts')
    .upsert(
      {
        delay_log_id: delayLogId,
        draft_content: draftContent,
        draft_pdf_path: draftPath,
      },
      { onConflict: 'delay_log_id' },
    )
    .select('id')
    .single();

  if (draftError || !nodDraft) {
    return { ok: false, error: `NOD draft record failed: ${draftError?.message ?? 'unknown'}` };
  }

  // 6. Advance legal_status: pending → draft (only after upload + record succeed)
  const { error: statusError } = await supabase
    .from('delay_logs')
    .update({
      legal_status: 'draft',
      nod_draft_id: nodDraft.id,
    })
    .eq('id', delayLogId);

  if (statusError) {
    return { ok: false, error: `Draft PDF uploaded but status update failed: ${statusError.message}` };
  }

  // Audit: NOD draft created (non-blocking — draft generation is auto-triggered)
  await writeAuditEntry({
    tableName: 'delay_logs',
    recordId: delayLogId,
    action: 'legal_draft_created',
    changedBy: session.user.id,
    oldValue: { legal_status: 'pending' },
    newValue: { legal_status: 'draft', nod_draft_id: nodDraft.id },
    reason: `NOD draft auto-generated for ${ctx.area.name} — ${ctx.delay.tradeName}`,
  });

  return { ok: true, nodDraftId: nodDraft.id, draftPath };
}

// ─── Approve NOD Draft ──────────────────────────────

/**
 * GC approves a draft NOD by signing it. Generates final PDF with signature,
 * uploads to final evidence path, and advances status to 'sent'.
 *
 * Reconciliation: status only advances after verified upload.
 */
export async function approveNodDraft(
  delayLogId: string,
  signature: SignatureInput,
): Promise<ApproveNodResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // 1. Fetch context (must be in 'draft' status)
  const context = await fetchDelayContext(supabase, delayLogId, session.user, ['draft']);
  if (!context.ok) return { ok: false, error: context.error };

  // 2. Generate final PDF with signature
  const pdfBytes = await buildPdf(context.data, { signature });

  // 3. Upload final evidence (PDF + signature PNG + audit JSON)
  const uploadResult = await uploadEvidence(
    delayLogId,
    pdfBytes.buffer as ArrayBuffer,
    signature,
  );

  if (!uploadResult.ok) return { ok: false, error: uploadResult.error };

  // 4. Update nod_drafts: mark as sent
  const { error: nodError } = await supabase
    .from('nod_drafts')
    .update({
      sent_at: new Date().toISOString(),
      sent_by: session.user.id,
    })
    .eq('delay_log_id', delayLogId);

  if (nodError) {
    // Non-blocking: evidence is uploaded, nod_draft update is secondary
    console.error(`[nodAutoGen] Failed to update nod_draft sent_at: ${nodError.message}`);
  }

  // 5. Advance legal_status: draft → sent (only after evidence upload succeeds)
  const { error: statusError } = await supabase
    .from('delay_logs')
    .update({ legal_status: 'sent' })
    .eq('id', delayLogId);

  if (statusError) {
    return { ok: false, error: `Evidence uploaded but status update failed: ${statusError.message}` };
  }

  // Audit: NOD sent (critical legal event — atomic)
  const audit = await writeAuditEntry({
    tableName: 'delay_logs',
    recordId: delayLogId,
    action: 'legal_doc_sent',
    changedBy: session.user.id,
    oldValue: { legal_status: 'draft' },
    newValue: { legal_status: 'sent', sha256: uploadResult.hash },
    reason: `NOD signed and sent — SHA-256: ${uploadResult.hash}`,
  });

  if (!audit.ok) {
    // Legal doc sent without audit = unacceptable. Revert status.
    await supabase.from('delay_logs').update({ legal_status: 'draft' }).eq('id', delayLogId);
    return { ok: false, error: audit.error };
  }

  // 6. Send NOD email to GC (fire-and-forget — never blocks legal flow)
  try {
    const ctx = context.data;
    const { sendNodEmail } = await import('@/lib/email/sendEmail');

    // Fetch GC org users to email — need project's gc_org_id
    const serviceClient = createServiceClient();
    const { data: proj } = await serviceClient
      .from('projects')
      .select('gc_org_id')
      .eq('name', ctx.project.name)
      .limit(1)
      .single();

    const trackingUuid = crypto.randomUUID();

    if (proj?.gc_org_id) {
      const { data: gcUsers } = await serviceClient
        .from('users')
        .select('email, name, language')
        .eq('org_id', proj.gc_org_id)
        .in('role', ['gc_admin', 'gc_pm']);

      for (const gcUser of gcUsers ?? []) {
        void sendNodEmail({
          to: gcUser.email,
          recipientName: gcUser.name ?? 'Project Manager',
          projectName: ctx.project.name,
          areaName: ctx.area.name,
          tradeName: ctx.delay.tradeName,
          reasonCode: ctx.delay.reasonCode,
          dailyCost: `$${Number(ctx.delay.dailyCost ?? 0).toLocaleString()}`,
          cumulativeCost: `$${Number(ctx.delay.cumulativeCost ?? 0).toLocaleString()}`,
          signedAt: new Date().toLocaleString('en-US'),
          hash: uploadResult.hash,
          trackingUuid,
          language: (gcUser.language as 'en' | 'es') ?? 'en',
        });
      }
    }
  } catch (emailErr) {
    // Email failure NEVER blocks NOD approval — legal doc is already signed and stored
    console.error('[nodAutoGen] NOD email dispatch failed (non-blocking):', emailErr);
  }

  return {
    ok: true,
    path: uploadResult.path,
    hash: uploadResult.hash,
    signaturePath: uploadResult.signaturePath ?? '',
  };
}

// ─── Helpers ────────────────────────────────────────

async function getProjectIdForDelay(
  supabase: ReturnType<typeof createServiceClient>,
  delayLogId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('delay_logs')
    .select('areas!inner ( project_id )')
    .eq('id', delayLogId)
    .single();

  if (!data) return null;
  const area = data.areas as unknown as { project_id: string };
  return area.project_id;
}
