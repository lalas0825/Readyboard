'use server';

import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { uploadEvidence } from './evidenceStorage';
import type { SignatureInput } from './evidenceStorage';

// ─── Types ──────────────────────────────────────────

export type AssembleDocInput = {
  delayLogId: string;
  /** Signature data from SignaturePad component */
  signature: SignatureInput;
};

export type AssembleDocResult =
  | { ok: true; path: string; hash: string; signaturePath: string }
  | { ok: false; error: string };

type DelayContext = {
  project: {
    name: string;
    address: string;
    jurisdiction: string;
    laborRate: number;
  };
  area: {
    name: string;
    floor: string;
  };
  delay: {
    id: string;
    tradeName: string;
    reasonCode: string;
    crewSize: number;
    startedAt: string;
    endedAt: string | null;
    manHours: number;
    dailyCost: number;
    cumulativeCost: number;
  };
  org: {
    name: string;
  };
  user: {
    name: string;
  };
};

// ─── Constants ──────────────────────────────────────

const MARGIN = 50;
const PAGE_WIDTH = PageSizes.Letter[0]; // 612
const PAGE_HEIGHT = PageSizes.Letter[1]; // 792
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR = {
  black: rgb(0.067, 0.067, 0.067),
  dark: rgb(0.2, 0.2, 0.2),
  mid: rgb(0.4, 0.4, 0.4),
  light: rgb(0.6, 0.6, 0.6),
  line: rgb(0.85, 0.85, 0.85),
  accent: rgb(0.72, 0.53, 0.04), // Amber-700
};

// ─── Assembler ──────────────────────────────────────

/**
 * Assembles a complete legal evidence PDF from delay_log data + signature,
 * uploads it to the legal-docs bucket, and progresses the delay_log to 'sent'.
 *
 * Atomicity: if upload fails, the delay_log status is NOT advanced.
 * The status progression (draft → sent) only happens after successful upload.
 */
export async function assembleAndUpload(
  input: AssembleDocInput,
): Promise<AssembleDocResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // 1. Fetch all context needed for the document
  const context = await fetchDelayContext(supabase, input.delayLogId, session.user);
  if (!context.ok) return { ok: false, error: context.error };

  // 2. Generate the PDF
  const pdfBytes = await buildPdf(context.data, input.signature);

  // 3. Upload evidence (PDF + signature PNG + audit JSON)
  // uploadEvidence handles: hash computation, storage upload, DB update
  const uploadResult = await uploadEvidence(
    input.delayLogId,
    pdfBytes.buffer as ArrayBuffer,
    input.signature,
  );

  if (!uploadResult.ok) return { ok: false, error: uploadResult.error };

  // 4. Progress delay_log status: draft → sent (atomic with upload success)
  const { error: statusError } = await supabase
    .from('delay_logs')
    .update({ legal_status: 'sent' })
    .eq('id', input.delayLogId);

  if (statusError) {
    return { ok: false, error: `PDF uploaded but status update failed: ${statusError.message}` };
  }

  return {
    ok: true,
    path: uploadResult.path,
    hash: uploadResult.hash,
    signaturePath: uploadResult.signaturePath ?? '',
  };
}

// ─── Data Fetching ──────────────────────────────────

async function fetchDelayContext(
  supabase: ReturnType<typeof createServiceClient>,
  delayLogId: string,
  user: { name: string },
): Promise<{ ok: true; data: DelayContext } | { ok: false; error: string }> {
  const { data: log } = await supabase
    .from('delay_logs')
    .select(`
      id, trade_name, reason_code, crew_size,
      started_at, ended_at, man_hours, daily_cost, cumulative_cost,
      legal_status,
      areas!inner (
        name, floor, project_id,
        projects!inner (
          name, address, legal_jurisdiction, labor_rate_per_hour,
          gc_org:organizations!projects_gc_org_id_fkey ( name )
        )
      )
    `)
    .eq('id', delayLogId)
    .single();

  if (!log) return { ok: false, error: 'Delay log not found' };
  if (log.legal_status !== 'draft') {
    return { ok: false, error: `Cannot assemble: delay_log status is '${log.legal_status}', expected 'draft'` };
  }

  const area = log.areas as unknown as Record<string, unknown>;
  const project = area.projects as unknown as Record<string, unknown>;
  const org = project.gc_org as unknown as Record<string, unknown>;

  return {
    ok: true,
    data: {
      project: {
        name: (project.name as string) ?? 'Unknown Project',
        address: (project.address as string) ?? '',
        jurisdiction: (project.legal_jurisdiction as string) ?? '',
        laborRate: Number(project.labor_rate_per_hour ?? 0),
      },
      area: {
        name: (area.name as string) ?? 'Unknown',
        floor: (area.floor as string) ?? '?',
      },
      delay: {
        id: log.id,
        tradeName: log.trade_name,
        reasonCode: log.reason_code,
        crewSize: log.crew_size ?? 1,
        startedAt: log.started_at,
        endedAt: log.ended_at,
        manHours: Number(log.man_hours),
        dailyCost: Number(log.daily_cost),
        cumulativeCost: Number(log.cumulative_cost),
      },
      org: {
        name: (org?.name as string) ?? 'Unknown Organization',
      },
      user: {
        name: user.name,
      },
    },
  };
}

// ─── PDF Builder ────────────────────────────────────

async function buildPdf(
  ctx: DelayContext,
  signature: SignatureInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Set document metadata
  doc.setTitle(`Notice of Delay — ${ctx.area.name}`);
  doc.setAuthor(ctx.org.name);
  doc.setSubject(`Delay Log ${ctx.delay.id}`);
  doc.setCreator('ReadyBoard Legal Engine');
  doc.setProducer('ReadyBoard v5.0 / pdf-lib');
  doc.setCreationDate(new Date());

  const page = doc.addPage(PageSizes.Letter);
  let y = PAGE_HEIGHT - MARGIN;

  // ─── Header ─────────────────────────────────────

  // Document type badge
  page.drawText('NOTICE OF DELAY', {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 24;

  page.drawText(ctx.org.name.toUpperCase(), {
    x: MARGIN,
    y,
    size: 9,
    font: fontBold,
    color: COLOR.mid,
  });
  y -= 16;

  // Divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.5,
    color: COLOR.accent,
  });
  y -= 24;

  // Project info
  y = drawLabelValue(page, fontBold, fontRegular, 'Project', ctx.project.name, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Address', ctx.project.address, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Jurisdiction', ctx.project.jurisdiction, MARGIN, y);
  y -= 8;

  // Thin divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: COLOR.line,
  });
  y -= 20;

  // ─── Delay Details ──────────────────────────────

  page.drawText('DELAY DETAILS', {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR.black,
  });
  y -= 20;

  y = drawLabelValue(page, fontBold, fontRegular, 'Area', `${ctx.area.name} (Floor ${ctx.area.floor})`, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Trade', ctx.delay.tradeName, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Reason Code', formatReasonCode(ctx.delay.reasonCode), MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Crew Size', `${ctx.delay.crewSize} workers`, MARGIN, y);
  y -= 8;

  // Time block
  y = drawLabelValue(page, fontBold, fontRegular, 'Started', formatDate(ctx.delay.startedAt), MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Ended', ctx.delay.endedAt ? formatDate(ctx.delay.endedAt) : 'ONGOING', MARGIN, y);

  const durationHours = ctx.delay.crewSize > 0 ? ctx.delay.manHours / ctx.delay.crewSize : 0;
  y = drawLabelValue(page, fontBold, fontRegular, 'Duration', `${durationHours.toFixed(1)} hours`, MARGIN, y);
  y -= 8;

  // Thin divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: COLOR.line,
  });
  y -= 20;

  // ─── Cost Summary ───────────────────────────────

  page.drawText('COST IMPACT', {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR.black,
  });
  y -= 20;

  y = drawLabelValue(page, fontBold, fontRegular, 'Labor Rate', `$${ctx.project.laborRate.toFixed(2)}/hr`, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Man-Hours', `${ctx.delay.manHours.toFixed(2)} hrs`, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, 'Daily Cost', `$${ctx.delay.dailyCost.toFixed(2)}`, MARGIN, y);

  // Cumulative cost — emphasized
  y -= 4;
  page.drawText('Cumulative Cost:', {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: COLOR.dark,
  });
  page.drawText(`$${ctx.delay.cumulativeCost.toFixed(2)}`, {
    x: MARGIN + 120,
    y,
    size: 14,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 24;

  // Thin divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: COLOR.line,
  });
  y -= 20;

  // ─── Signature Section ──────────────────────────

  page.drawText('AUTHORIZED BY', {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR.black,
  });
  y -= 16;

  // Embed signature image
  const sigBase64 = signature.imageBase64.split(',')[1];
  const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
  const sigImage = await doc.embedPng(sigBytes);

  const sigMaxWidth = 200;
  const sigAspect = sigImage.width / sigImage.height;
  const sigDisplayWidth = Math.min(sigMaxWidth, sigImage.width);
  const sigDisplayHeight = sigDisplayWidth / sigAspect;

  page.drawImage(sigImage, {
    x: MARGIN,
    y: y - sigDisplayHeight,
    width: sigDisplayWidth,
    height: sigDisplayHeight,
  });
  y -= sigDisplayHeight + 4;

  // Signature line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + sigMaxWidth, y },
    thickness: 0.5,
    color: COLOR.dark,
  });
  y -= 14;

  page.drawText(ctx.user.name, {
    x: MARGIN,
    y,
    size: 9,
    font: fontRegular,
    color: COLOR.dark,
  });

  page.drawText(`Signed: ${formatDate(signature.metadata.capturedAt)}`, {
    x: MARGIN + sigMaxWidth + 20,
    y,
    size: 8,
    font: fontRegular,
    color: COLOR.mid,
  });
  y -= 14;

  page.drawText(`${signature.metadata.strokeCount} strokes, ${signature.metadata.totalPoints} points captured`, {
    x: MARGIN,
    y,
    size: 7,
    font: fontRegular,
    color: COLOR.light,
  });

  // ─── Footer ─────────────────────────────────────

  const footerY = MARGIN + 30;

  page.drawLine({
    start: { x: MARGIN, y: footerY + 16 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 16 },
    thickness: 0.5,
    color: COLOR.line,
  });

  page.drawText('READYBOARD LEGAL ENGINE — TAMPER-EVIDENT DOCUMENT', {
    x: MARGIN,
    y: footerY,
    size: 7,
    font: fontBold,
    color: COLOR.light,
  });

  page.drawText(`Document ID: ${ctx.delay.id}`, {
    x: MARGIN,
    y: footerY - 11,
    size: 7,
    font: fontRegular,
    color: COLOR.light,
  });

  page.drawText(`Generated: ${new Date().toISOString()}`, {
    x: MARGIN,
    y: footerY - 22,
    size: 7,
    font: fontRegular,
    color: COLOR.light,
  });

  // Note: SHA-256 hash will be computed after PDF generation
  // and stored in the database for verification
  page.drawText('SHA-256 hash of this document is stored in the ReadyBoard database for integrity verification.', {
    x: MARGIN,
    y: footerY - 33,
    size: 6,
    font: fontRegular,
    color: COLOR.light,
  });

  // ─── Finalize ───────────────────────────────────

  return doc.save();
}

// ─── Helpers ────────────────────────────────────────

function drawLabelValue(
  page: ReturnType<PDFDocument['addPage']>,
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontRegular: Awaited<ReturnType<PDFDocument['embedFont']>>,
  label: string,
  value: string,
  x: number,
  y: number,
): number {
  page.drawText(`${label}:`, {
    x,
    y,
    size: 9,
    font: fontBold,
    color: COLOR.mid,
  });
  page.drawText(value, {
    x: x + 120,
    y,
    size: 10,
    font: fontRegular,
    color: COLOR.dark,
  });
  return y - 16;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatReasonCode(code: string): string {
  const map: Record<string, string> = {
    no_heat: 'No Heat',
    prior_trade: 'Prior Trade Incomplete',
    no_access: 'No Access',
    inspection: 'Inspection Pending',
    plumbing: 'Plumbing Issue',
    material: 'Material Unavailable',
    moisture: 'Moisture Damage',
    safety: 'Safety Concern',
    other: 'Other',
  };
  return map[code] ?? code;
}
