'use server';

import { PDFDocument, StandardFonts, PageSizes } from 'pdf-lib';
import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { uploadEvidence } from './evidenceStorage';
import type { SignatureInput } from './evidenceStorage';
import type { PdfLocale } from './pdfTexts';
import { PDF_TEXTS } from './pdfTexts';
import { fetchLaborBreakdown, formatRoleLabel } from './laborBreakdown';
import type { LaborBreakdown } from './laborBreakdown';
import {
  MARGIN,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  COLOR,
  drawLabelValue,
  drawSectionHeader,
  drawDivider,
  drawAccentDivider,
  drawFooterWithHash,
  embedSignatureBlock,
  drawDraftWatermark,
  drawTableHeader,
  drawTableRow,
  formatDate,
  formatReasonCode,
  formatCurrency,
  computePdfHash,
} from './pdfHelpers';

// ─── Types ──────────────────────────────────────────

export type AssembleDocInput = {
  delayLogId: string;
  signature: SignatureInput;
  locale?: PdfLocale;
};

export type AssembleDocResult =
  | { ok: true; path: string; hash: string; signaturePath: string }
  | { ok: false; error: string };

export type DelayContext = {
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
  laborBreakdown?: LaborBreakdown | null;
};

// ─── Assembler ──────────────────────────────────────

/**
 * Assembles a complete legal evidence PDF from delay_log data + signature,
 * uploads it to the legal-docs bucket, and progresses the delay_log to 'sent'.
 *
 * Atomicity: if upload fails, the delay_log status is NOT advanced.
 */
export async function assembleAndUpload(
  input: AssembleDocInput,
): Promise<AssembleDocResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const context = await fetchDelayContext(supabase, input.delayLogId, session.user);
  if (!context.ok) return { ok: false, error: context.error };

  const pdfBytes = await buildPdf(context.data, {
    signature: input.signature,
    locale: input.locale,
  });

  const uploadResult = await uploadEvidence(
    input.delayLogId,
    pdfBytes.buffer as ArrayBuffer,
    input.signature,
  );

  if (!uploadResult.ok) return { ok: false, error: uploadResult.error };

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

export async function fetchDelayContext(
  supabase: ReturnType<typeof createServiceClient>,
  delayLogId: string,
  user: { name: string },
  allowedStatuses: string[] = ['draft'],
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
  if (!allowedStatuses.includes(log.legal_status ?? '')) {
    return { ok: false, error: `Cannot assemble: delay_log status is '${log.legal_status}', expected one of: ${allowedStatuses.join(', ')}` };
  }

  const area = log.areas as unknown as Record<string, unknown>;
  const project = area.projects as unknown as Record<string, unknown>;
  const org = project.gc_org as unknown as Record<string, unknown>;

  const projectId = area.project_id as string;
  const laborBreakdown = await fetchLaborBreakdown(supabase, projectId, log.trade_name);

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
      laborBreakdown,
    },
  };
}

// ─── PDF Builder ────────────────────────────────────

export type BuildPdfOptions = {
  isDraft?: boolean;
  signature?: SignatureInput;
  locale?: PdfLocale;
};

export async function buildPdf(
  ctx: DelayContext,
  signatureOrOptions?: SignatureInput | BuildPdfOptions,
): Promise<Uint8Array> {
  // Backwards-compatible: if SignatureInput passed directly, wrap it
  const options: BuildPdfOptions =
    signatureOrOptions && 'imageBase64' in signatureOrOptions
      ? { signature: signatureOrOptions }
      : (signatureOrOptions as BuildPdfOptions) ?? {};

  const { isDraft = false, signature, locale = 'en' } = options;
  const t = PDF_TEXTS[locale];
  const doc = await PDFDocument.create();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold: fontBold, regular: fontRegular };

  doc.setTitle(`${t.nodTitle} — ${ctx.area.name}`);
  doc.setAuthor(ctx.org.name);
  doc.setSubject(`Delay Log ${ctx.delay.id}`);
  doc.setCreator('ReadyBoard Legal Engine');
  doc.setProducer('ReadyBoard v5.1 / pdf-lib');
  doc.setCreationDate(new Date());

  const page = doc.addPage(PageSizes.Letter);
  let y = PAGE_HEIGHT - MARGIN;

  // ─── Header ─────────────────────────────────────

  page.drawText(t.nodTitle, {
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

  y = drawAccentDivider(page, y);

  // Project info
  y = drawLabelValue(page, fontBold, fontRegular, t.project, ctx.project.name, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.address, ctx.project.address, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.jurisdiction, ctx.project.jurisdiction, MARGIN, y);
  y -= 8;
  y = drawDivider(page, y);

  // ─── Delay Details ──────────────────────────────

  y = drawSectionHeader(page, fontBold, t.delayDetails, MARGIN, y);

  y = drawLabelValue(page, fontBold, fontRegular, t.area, `${ctx.area.name} (${t.floor} ${ctx.area.floor})`, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.trade, ctx.delay.tradeName, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.reasonCode, formatReasonCode(ctx.delay.reasonCode, locale), MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.crewSize, `${ctx.delay.crewSize} ${t.workers}`, MARGIN, y);
  y -= 8;

  y = drawLabelValue(page, fontBold, fontRegular, t.started, formatDate(ctx.delay.startedAt, locale), MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.ended, ctx.delay.endedAt ? formatDate(ctx.delay.endedAt, locale) : t.ongoing, MARGIN, y);

  const durationHours = ctx.delay.crewSize > 0 ? ctx.delay.manHours / ctx.delay.crewSize : 0;
  y = drawLabelValue(page, fontBold, fontRegular, t.duration, `${durationHours.toFixed(1)} ${t.hours}`, MARGIN, y);
  y -= 8;
  y = drawDivider(page, y);

  // ─── Cost Summary ───────────────────────────────

  y = drawSectionHeader(page, fontBold, t.costImpact, MARGIN, y);

  if (ctx.laborBreakdown && ctx.laborBreakdown.lines.length > 0) {
    // ── Itemized role-by-role table ────────────────
    const roleLabel = locale === 'es' ? 'Rol' : 'Role';
    const countLabel = locale === 'es' ? 'Cant.' : 'Count';
    const rateLabel = locale === 'es' ? 'Tarifa/hr' : 'Rate/hr';
    const hoursLabel = locale === 'es' ? 'Horas' : 'Hours';
    const subLabel = locale === 'es' ? 'Subtotal' : 'Subtotal';

    const roleColumns = [
      { header: roleLabel, width: 110 },
      { header: countLabel, width: 40, align: 'right' as const },
      { header: rateLabel, width: 60, align: 'right' as const },
      { header: hoursLabel, width: 45, align: 'right' as const },
      { header: subLabel, width: 70, align: 'right' as const },
    ];

    y = drawTableHeader(page, fontBold, roleColumns, MARGIN, y);

    for (const line of ctx.laborBreakdown.lines) {
      y = drawTableRow(page, fontRegular, roleColumns, [
        formatRoleLabel(line.role),
        String(line.count),
        formatCurrency(line.ratePerHour),
        `${line.hours}h`,
        formatCurrency(line.subtotal),
      ], MARGIN, y, 7);
    }

    // Daily cost total row
    y -= 2;
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
      thickness: 0.5,
      color: COLOR.mid,
    });
    const dailyTotalStr = formatCurrency(ctx.laborBreakdown.totalDailyCost);
    const dtWidth = fontBold.widthOfTextAtSize(dailyTotalStr, 9);
    page.drawText(`${t.dailyCost}:`, { x: MARGIN, y, size: 9, font: fontBold, color: COLOR.dark });
    page.drawText(dailyTotalStr, { x: PAGE_WIDTH - MARGIN - dtWidth, y, size: 9, font: fontBold, color: COLOR.dark });
    y -= 12;

    y = drawLabelValue(page, fontBold, fontRegular, t.manHours, `${ctx.delay.manHours.toFixed(2)} ${t.hours}`, MARGIN, y);
  } else {
    // ── Fallback: flat rate display ────────────────
    y = drawLabelValue(page, fontBold, fontRegular, t.laborRate, `${formatCurrency(ctx.project.laborRate)}/${locale === 'es' ? 'hr' : 'hr'}`, MARGIN, y);
    y = drawLabelValue(page, fontBold, fontRegular, t.manHours, `${ctx.delay.manHours.toFixed(2)} ${t.hours}`, MARGIN, y);
    y = drawLabelValue(page, fontBold, fontRegular, t.dailyCost, formatCurrency(ctx.delay.dailyCost), MARGIN, y);
  }

  // Cumulative cost — always emphasized
  y -= 4;
  page.drawText(`${t.cumulativeCost}:`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: COLOR.dark,
  });
  page.drawText(formatCurrency(ctx.delay.cumulativeCost), {
    x: MARGIN + 120,
    y,
    size: 14,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 24;
  y = drawDivider(page, y);

  // ─── Signature / Draft ──────────────────────────

  if (isDraft) {
    y = drawDraftWatermark(page, fonts, ctx.user.name, locale, y);
  } else if (signature) {
    y = await embedSignatureBlock(doc, page, fonts, signature, ctx.user.name, locale, y);
  }

  // ─── Footer ─────────────────────────────────────

  // Compute hash for the footer
  const tempBytes = await doc.save();
  const hash = await computePdfHash(tempBytes);

  drawFooterWithHash(page, fonts, ctx.delay.id, hash, locale);

  return doc.save();
}
