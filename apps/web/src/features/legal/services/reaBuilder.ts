// ─── REA PDF Builder ────────────────────────────────────────
// Builds a Request for Equitable Adjustment PDF.
// Multi-page: claim summary + itemized cost table + referenced NODs + signature.

import { PDFDocument, StandardFonts, PageSizes } from 'pdf-lib';
import type { SignatureInput } from './evidenceStorage';
import type { PdfLocale } from './pdfTexts';
import { PDF_TEXTS } from './pdfTexts';
import {
  MARGIN,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  COLOR,
  type PageContext,
  addPageIfNeeded,
  drawLabelValue,
  drawSectionHeader,
  drawDivider,
  drawAccentDivider,
  drawFooterWithHash,
  embedSignatureBlock,
  drawDraftWatermark,
  drawTableHeader,
  drawTableRow,
  type TableColumn,
  formatDate,
  formatDateShort,
  formatReasonCode,
  formatCurrency,
  computePdfHash,
} from './pdfHelpers';

// ─── Types ──────────────────────────────────────────

export type ReaDelayItem = {
  id: string;
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  crewSize: number;
  startedAt: string;
  endedAt: string | null;
  manHours: number;
  dailyCost: number;
  cumulativeCost: number;
};

export type ReaNodReference = {
  id: string;
  sentAt: string;
  sha256Hash: string | null;
  areaName: string;
  tradeName: string;
};

export type ReaContext = {
  project: { name: string; address: string; jurisdiction: string; laborRate: number };
  org: { name: string };
  user: { name: string };
  delays: ReaDelayItem[];
  relatedNods: ReaNodReference[];
  overheadMultiplier: number;
  totalClaimAmount: number;
  documentId: string;
};

export type BuildReaPdfOptions = {
  signature?: SignatureInput;
  isDraft?: boolean;
  locale?: PdfLocale;
};

// ─── Builder ────────────────────────────────────────

export async function buildReaPdf(
  ctx: ReaContext,
  options: BuildReaPdfOptions = {},
): Promise<Uint8Array> {
  const { isDraft = false, signature, locale = 'en' } = options;
  const t = PDF_TEXTS[locale];

  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold: fontBold, regular: fontRegular };

  doc.setTitle(`${t.reaTitle} — ${ctx.project.name}`);
  doc.setAuthor(ctx.org.name);
  doc.setSubject(`REA ${ctx.documentId}`);
  doc.setCreator('ReadyBoard Legal Engine');
  doc.setProducer('ReadyBoard v5.1 / pdf-lib');
  doc.setCreationDate(new Date());

  let page = doc.addPage(PageSizes.Letter);
  let y = PAGE_HEIGHT - MARGIN;
  let pCtx: PageContext = { doc, page, y, fontBold, fontRegular, pageNumber: 1 };

  // ─── Header ─────────────────────────────────────

  page.drawText(t.reaTitle, {
    x: MARGIN,
    y,
    size: 16,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 22;

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

  // ─── Claim Summary ──────────────────────────────

  y = drawSectionHeader(page, fontBold, t.claimSummary, MARGIN, y);

  // Total claim — large emphasis
  page.drawText(`${t.totalClaim}:`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR.dark,
  });
  page.drawText(formatCurrency(ctx.totalClaimAmount), {
    x: MARGIN + 160,
    y,
    size: 16,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 24;

  const subtotal = ctx.delays.reduce((sum, d) => sum + d.cumulativeCost, 0);
  const overheadAmount = ctx.totalClaimAmount - subtotal;
  y = drawLabelValue(page, fontBold, fontRegular, t.subtotal, formatCurrency(subtotal), MARGIN, y, 160);
  y = drawLabelValue(page, fontBold, fontRegular, `${t.overhead} (${((ctx.overheadMultiplier - 1) * 100).toFixed(0)}%)`, formatCurrency(overheadAmount), MARGIN, y, 160);
  y = drawLabelValue(page, fontBold, fontRegular, t.laborRate, `${formatCurrency(ctx.project.laborRate)}/hr`, MARGIN, y, 160);

  // Date range
  const dates = ctx.delays.map((d) => new Date(d.startedAt).getTime());
  const earliest = new Date(Math.min(...dates)).toISOString();
  const latestEnd = ctx.delays
    .filter((d) => d.endedAt)
    .map((d) => new Date(d.endedAt!).getTime());
  const latest = latestEnd.length > 0
    ? new Date(Math.max(...latestEnd)).toISOString()
    : new Date().toISOString();
  y = drawLabelValue(page, fontBold, fontRegular, t.dateRange, `${formatDateShort(earliest, locale)} — ${formatDateShort(latest, locale)}`, MARGIN, y, 160);
  y -= 8;
  y = drawDivider(page, y);

  // ─── Itemized Cost Table ────────────────────────

  y = drawSectionHeader(page, fontBold, t.itemizedCosts, MARGIN, y);

  const costColumns: TableColumn[] = [
    { header: t.area, width: 80 },
    { header: t.trade, width: 75 },
    { header: t.reasonCode, width: 75 },
    { header: t.crewSize, width: 40 },
    { header: t.manHours, width: 55, align: 'right' },
    { header: t.dailyCost, width: 65, align: 'right' },
    { header: t.cumulativeCost, width: 75, align: 'right' },
  ];

  y = drawTableHeader(page, fontBold, costColumns, MARGIN, y);

  for (const delay of ctx.delays) {
    pCtx = { ...pCtx, page, y };
    pCtx = addPageIfNeeded(pCtx, 20);
    page = pCtx.page;
    y = pCtx.y;

    y = drawTableRow(page, fontRegular, costColumns, [
      `${delay.areaName} (F${delay.floor})`,
      delay.tradeName,
      formatReasonCode(delay.reasonCode, locale),
      String(delay.crewSize),
      `${delay.manHours.toFixed(1)}`,
      formatCurrency(delay.dailyCost),
      formatCurrency(delay.cumulativeCost),
    ], MARGIN, y, 7);
  }

  // Total row
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 8 },
    thickness: 0.5,
    color: COLOR.dark,
  });
  const totalStr = formatCurrency(ctx.totalClaimAmount);
  const totalWidth = fontBold.widthOfTextAtSize(totalStr, 9);
  page.drawText(`${t.totalClaim}:`, {
    x: MARGIN,
    y,
    size: 9,
    font: fontBold,
    color: COLOR.dark,
  });
  page.drawText(totalStr, {
    x: PAGE_WIDTH - MARGIN - totalWidth,
    y,
    size: 9,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 20;
  y = drawDivider(page, y);

  // ─── Referenced NODs ────────────────────────────

  if (ctx.relatedNods.length > 0) {
    pCtx = { ...pCtx, page, y };
    pCtx = addPageIfNeeded(pCtx, 60);
    page = pCtx.page;
    y = pCtx.y;

    y = drawSectionHeader(page, fontBold, t.referencedNods, MARGIN, y);

    const nodColumns: TableColumn[] = [
      { header: t.area, width: 100 },
      { header: t.trade, width: 90 },
      { header: t.sentAt, width: 130 },
      { header: t.sha256Hash, width: 150 },
    ];

    y = drawTableHeader(page, fontBold, nodColumns, MARGIN, y);

    for (const nod of ctx.relatedNods) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 20);
      page = pCtx.page;
      y = pCtx.y;

      y = drawTableRow(page, fontRegular, nodColumns, [
        nod.areaName,
        nod.tradeName,
        formatDate(nod.sentAt, locale),
        nod.sha256Hash ? `${nod.sha256Hash.slice(0, 16)}...` : '—',
      ], MARGIN, y, 7);
    }

    y -= 8;
    y = drawDivider(page, y);
  }

  // ─── Signature / Draft ──────────────────────────

  pCtx = { ...pCtx, page, y };
  pCtx = addPageIfNeeded(pCtx, 100);
  page = pCtx.page;
  y = pCtx.y;

  if (isDraft) {
    y = drawDraftWatermark(page, fonts, ctx.user.name, locale, y);
  } else if (signature) {
    y = await embedSignatureBlock(doc, page, fonts, signature, ctx.user.name, locale, y);
  }

  // ─── Footer on all pages ────────────────────────

  const tempBytes = await doc.save();
  const hash = await computePdfHash(tempBytes);
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawFooterWithHash(pages[i], fonts, ctx.documentId, hash, locale, i + 1, pages.length);
  }

  return doc.save();
}
