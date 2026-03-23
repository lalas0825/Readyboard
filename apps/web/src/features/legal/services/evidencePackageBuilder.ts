// ─── Evidence Package PDF Builder ────────────────────────────
// Multi-page arbitration-ready evidence package.
// Sections: Cover, Chronological Narrative, NODs + Receipts,
// REAs + Costs, GPS Log, Photo Exhibits, CA History, Financial Summary.

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
  type TableColumn,
  addPageIfNeeded,
  startNewPage,
  drawLabelValue,
  drawSectionHeader,
  drawDivider,
  drawAccentDivider,
  drawFooterWithHash,
  embedSignatureBlock,
  drawTableHeader,
  drawTableRow,
  formatDate,
  formatDateShort,
  formatReasonCode,
  formatCurrency,
  computePdfHash,
} from './pdfHelpers';

// ─── Types ──────────────────────────────────────────

export type EvidenceDelay = {
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

export type EvidenceNod = {
  id: string;
  areaName: string;
  tradeName: string;
  sentAt: string;
  sha256Hash: string | null;
  firstOpenedAt: string | null;
  openCount: number;
  receiptEvents: Array<{
    ipAddress: string | null;
    deviceType: string | null;
    openedAt: string;
  }>;
};

export type EvidenceRea = {
  id: string;
  totalClaimAmount: number;
  sha256Hash: string | null;
  generatedAt: string;
  delayCount: number;
};

export type EvidenceFieldReport = {
  id: string;
  areaName: string;
  tradeName: string;
  gpsLat: number | null;
  gpsLng: number | null;
  deviceId: string | null;
  photoUrl: string | null;
  createdAt: string;
  offlineCreatedAt: string | null;
};

export type EvidenceCa = {
  id: string;
  areaName: string;
  tradeName: string;
  note: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  inResolutionAt: string | null;
  resolvedAt: string | null;
};

export type FinancialSummaryItem = {
  key: string;
  label: string;
  totalCost: number;
  manHours: number;
  delayCount: number;
};

export type EvidencePackageContext = {
  project: { name: string; address: string; jurisdiction: string; laborRate: number };
  org: { name: string };
  user: { name: string };
  delays: EvidenceDelay[];
  nods: EvidenceNod[];
  reas: EvidenceRea[];
  fieldReports: EvidenceFieldReport[];
  correctiveActions: EvidenceCa[];
  financialByCause: FinancialSummaryItem[];
  financialByParty: FinancialSummaryItem[];
  grandTotal: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  documentId: string;
};

export type BuildEvidencePackagePdfOptions = {
  signature?: SignatureInput;
  locale?: PdfLocale;
};

// ─── Builder ────────────────────────────────────────

export async function buildEvidencePackagePdf(
  ctx: EvidencePackageContext,
  options: BuildEvidencePackagePdfOptions = {},
): Promise<Uint8Array> {
  const { signature, locale = 'en' } = options;
  const t = PDF_TEXTS[locale];

  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold: fontBold, regular: fontRegular };

  doc.setTitle(`${t.evidenceTitle} — ${ctx.project.name}`);
  doc.setAuthor(ctx.org.name);
  doc.setSubject(`Evidence Package ${ctx.documentId}`);
  doc.setCreator('ReadyBoard Legal Engine');
  doc.setProducer('ReadyBoard v5.1 / pdf-lib');
  doc.setCreationDate(new Date());

  let page = doc.addPage(PageSizes.Letter);
  let y = PAGE_HEIGHT - MARGIN;
  let pCtx: PageContext = { doc, page, y, fontBold, fontRegular, pageNumber: 1 };

  // ═══════════════════════════════════════════════════
  // SECTION 1: Cover Page
  // ═══════════════════════════════════════════════════

  page.drawText(t.evidenceTitle, {
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

  y = drawLabelValue(page, fontBold, fontRegular, t.project, ctx.project.name, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.address, ctx.project.address, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.jurisdiction, ctx.project.jurisdiction, MARGIN, y);
  y = drawLabelValue(page, fontBold, fontRegular, t.dateRange, `${formatDateShort(ctx.dateRangeStart, locale)} — ${formatDateShort(ctx.dateRangeEnd, locale)}`, MARGIN, y, 120);
  y -= 12;

  // Summary stats
  page.drawText(t.grandTotal, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR.dark,
  });
  page.drawText(formatCurrency(ctx.grandTotal), {
    x: MARGIN + 160,
    y,
    size: 16,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 24;

  y = drawLabelValue(page, fontBold, fontRegular, 'Delays', String(ctx.delays.length), MARGIN, y, 160);
  y = drawLabelValue(page, fontBold, fontRegular, 'NODs', String(ctx.nods.length), MARGIN, y, 160);
  y = drawLabelValue(page, fontBold, fontRegular, 'REAs', String(ctx.reas.length), MARGIN, y, 160);
  y = drawLabelValue(page, fontBold, fontRegular, 'Field Reports', String(ctx.fieldReports.length), MARGIN, y, 160);
  y = drawLabelValue(page, fontBold, fontRegular, 'Corrective Actions', String(ctx.correctiveActions.length), MARGIN, y, 160);

  y -= 8;
  y = drawDivider(page, y);

  // ═══════════════════════════════════════════════════
  // SECTION 2: Chronological Delay Narrative
  // ═══════════════════════════════════════════════════

  pCtx = { ...pCtx, page, y };
  pCtx = startNewPage(pCtx);
  page = pCtx.page;
  y = pCtx.y;

  y = drawSectionHeader(page, fontBold, t.chronologicalNarrative, MARGIN, y);

  const sortedDelays = [...ctx.delays].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  const delayCols: TableColumn[] = [
    { header: t.area, width: 80 },
    { header: t.trade, width: 70 },
    { header: t.reasonCode, width: 70 },
    { header: t.crewSize, width: 35 },
    { header: t.started, width: 80 },
    { header: t.manHours, width: 50, align: 'right' },
    { header: t.cumulativeCost, width: 75, align: 'right' },
  ];

  y = drawTableHeader(page, fontBold, delayCols, MARGIN, y);

  for (const delay of sortedDelays) {
    pCtx = { ...pCtx, page, y };
    pCtx = addPageIfNeeded(pCtx, 20);
    page = pCtx.page;
    y = pCtx.y;

    y = drawTableRow(page, fontRegular, delayCols, [
      `${delay.areaName} (F${delay.floor})`,
      delay.tradeName,
      formatReasonCode(delay.reasonCode, locale),
      String(delay.crewSize),
      formatDateShort(delay.startedAt, locale),
      `${delay.manHours.toFixed(1)}`,
      formatCurrency(delay.cumulativeCost),
    ], MARGIN, y, 7);
  }

  y -= 8;
  y = drawDivider(page, y);

  // ═══════════════════════════════════════════════════
  // SECTION 3: NODs with Receipt Confirmations
  // ═══════════════════════════════════════════════════

  if (ctx.nods.length > 0) {
    pCtx = { ...pCtx, page, y };
    pCtx = startNewPage(pCtx);
    page = pCtx.page;
    y = pCtx.y;

    y = drawSectionHeader(page, fontBold, t.nodsWithReceipts, MARGIN, y);

    for (const nod of ctx.nods) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 80);
      page = pCtx.page;
      y = pCtx.y;

      y = drawLabelValue(page, fontBold, fontRegular, t.area, nod.areaName, MARGIN, y);
      y = drawLabelValue(page, fontBold, fontRegular, t.trade, nod.tradeName, MARGIN, y);
      y = drawLabelValue(page, fontBold, fontRegular, t.sentAt, formatDate(nod.sentAt, locale), MARGIN, y);
      y = drawLabelValue(page, fontBold, fontRegular, t.sha256Hash, nod.sha256Hash ? `${nod.sha256Hash.slice(0, 32)}...` : '—', MARGIN, y);

      // Receipt status
      if (nod.firstOpenedAt) {
        y = drawLabelValue(page, fontBold, fontRegular, t.firstOpenedAt, formatDate(nod.firstOpenedAt, locale), MARGIN, y);
        y = drawLabelValue(page, fontBold, fontRegular, t.openCount, String(nod.openCount), MARGIN, y);

        // Receipt events
        for (const evt of nod.receiptEvents.slice(0, 5)) {
          page.drawText(`    ${formatDate(evt.openedAt, locale)} — ${evt.ipAddress ?? '?'} — ${evt.deviceType ?? '?'}`, {
            x: MARGIN + 10,
            y,
            size: 7,
            font: fontRegular,
            color: COLOR.light,
          });
          y -= 12;
        }
      } else {
        page.drawText(t.receiptNotOpened, {
          x: MARGIN + 120,
          y,
          size: 9,
          font: fontBold,
          color: COLOR.red,
        });
        y -= 16;
      }

      y -= 4;
      y = drawDivider(page, y);
    }
  }

  // ═══════════════════════════════════════════════════
  // SECTION 4: REAs with Cost Tables
  // ═══════════════════════════════════════════════════

  if (ctx.reas.length > 0) {
    pCtx = { ...pCtx, page, y };
    pCtx = startNewPage(pCtx);
    page = pCtx.page;
    y = pCtx.y;

    y = drawSectionHeader(page, fontBold, t.reasWithCosts, MARGIN, y);

    const reaCols: TableColumn[] = [
      { header: 'REA ID', width: 140 },
      { header: t.totalClaim, width: 100, align: 'right' },
      { header: 'Delays', width: 50 },
      { header: t.sha256Hash, width: 150 },
    ];

    y = drawTableHeader(page, fontBold, reaCols, MARGIN, y);

    for (const rea of ctx.reas) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 20);
      page = pCtx.page;
      y = pCtx.y;

      y = drawTableRow(page, fontRegular, reaCols, [
        rea.id.slice(0, 16) + '...',
        formatCurrency(rea.totalClaimAmount),
        String(rea.delayCount),
        rea.sha256Hash ? `${rea.sha256Hash.slice(0, 24)}...` : '—',
      ], MARGIN, y, 7);
    }

    y -= 8;
    y = drawDivider(page, y);
  }

  // ═══════════════════════════════════════════════════
  // SECTION 5: GPS Verification Log
  // ═══════════════════════════════════════════════════

  const gpsReports = ctx.fieldReports.filter((r) => r.gpsLat != null && r.gpsLng != null);
  if (gpsReports.length > 0) {
    pCtx = { ...pCtx, page, y };
    pCtx = startNewPage(pCtx);
    page = pCtx.page;
    y = pCtx.y;

    y = drawSectionHeader(page, fontBold, t.gpsVerificationLog, MARGIN, y);

    const gpsCols: TableColumn[] = [
      { header: t.area, width: 80 },
      { header: t.trade, width: 70 },
      { header: t.latitude, width: 80 },
      { header: t.longitude, width: 80 },
      { header: t.deviceId, width: 80 },
      { header: t.timestamp, width: 90 },
    ];

    y = drawTableHeader(page, fontBold, gpsCols, MARGIN, y);

    for (const report of gpsReports.slice(0, 100)) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 20);
      page = pCtx.page;
      y = pCtx.y;

      y = drawTableRow(page, fontRegular, gpsCols, [
        report.areaName,
        report.tradeName,
        report.gpsLat?.toFixed(6) ?? '—',
        report.gpsLng?.toFixed(6) ?? '—',
        report.deviceId ?? '—',
        formatDateShort(report.offlineCreatedAt ?? report.createdAt, locale),
      ], MARGIN, y, 7);
    }

    y -= 8;
    y = drawDivider(page, y);
  }

  // ═══════════════════════════════════════════════════
  // SECTION 6: Photo Exhibits
  // ═══════════════════════════════════════════════════

  const photoReports = ctx.fieldReports.filter((r) => r.photoUrl);
  if (photoReports.length > 0) {
    pCtx = { ...pCtx, page, y };
    pCtx = startNewPage(pCtx);
    page = pCtx.page;
    y = pCtx.y;

    y = drawSectionHeader(page, fontBold, t.photoExhibits, MARGIN, y);

    // List URLs (not embedded — file size concern). Max 20 inline, rest referenced.
    const exhibitLimit = 20;
    for (let i = 0; i < Math.min(photoReports.length, exhibitLimit); i++) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 30);
      page = pCtx.page;
      y = pCtx.y;

      const r = photoReports[i];
      const exhibitLabel = `${t.exhibit} ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`;

      page.drawText(exhibitLabel, {
        x: MARGIN,
        y,
        size: 9,
        font: fontBold,
        color: COLOR.dark,
      });
      y -= 14;

      y = drawLabelValue(page, fontBold, fontRegular, t.area, r.areaName, MARGIN + 10, y, 80);
      y = drawLabelValue(page, fontBold, fontRegular, t.timestamp, formatDate(r.offlineCreatedAt ?? r.createdAt, locale), MARGIN + 10, y, 80);
      page.drawText(r.photoUrl!, {
        x: MARGIN + 10,
        y,
        size: 7,
        font: fontRegular,
        color: COLOR.light,
      });
      y -= 14;
    }

    if (photoReports.length > exhibitLimit) {
      page.drawText(`+ ${photoReports.length - exhibitLimit} additional photos available in storage`, {
        x: MARGIN,
        y,
        size: 8,
        font: fontRegular,
        color: COLOR.mid,
      });
      y -= 16;
    }

    y -= 8;
    y = drawDivider(page, y);
  }

  // ═══════════════════════════════════════════════════
  // SECTION 7: Corrective Action History
  // ═══════════════════════════════════════════════════

  if (ctx.correctiveActions.length > 0) {
    pCtx = { ...pCtx, page, y };
    pCtx = startNewPage(pCtx);
    page = pCtx.page;
    y = pCtx.y;

    y = drawSectionHeader(page, fontBold, t.correctiveActionHistory, MARGIN, y);

    const caCols: TableColumn[] = [
      { header: t.area, width: 80 },
      { header: t.trade, width: 70 },
      { header: t.caCreated, width: 80 },
      { header: t.caAcknowledged, width: 80 },
      { header: t.caResolved, width: 80 },
      { header: t.responseTime, width: 70, align: 'right' },
    ];

    y = drawTableHeader(page, fontBold, caCols, MARGIN, y);

    for (const ca of ctx.correctiveActions) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 20);
      page = pCtx.page;
      y = pCtx.y;

      // Calculate response time
      let responseTime = t.noResponse;
      if (ca.acknowledgedAt) {
        const ackMs = new Date(ca.acknowledgedAt).getTime() - new Date(ca.createdAt).getTime();
        const ackHours = ackMs / 3_600_000;
        responseTime = ackHours < 24
          ? `${ackHours.toFixed(1)} ${t.hours}`
          : `${(ackHours / 24).toFixed(1)} ${t.days}`;
      }

      y = drawTableRow(page, fontRegular, caCols, [
        ca.areaName,
        ca.tradeName,
        formatDateShort(ca.createdAt, locale),
        ca.acknowledgedAt ? formatDateShort(ca.acknowledgedAt, locale) : '—',
        ca.resolvedAt ? formatDateShort(ca.resolvedAt, locale) : '—',
        responseTime,
      ], MARGIN, y, 7);
    }

    y -= 8;
    y = drawDivider(page, y);
  }

  // ═══════════════════════════════════════════════════
  // SECTION 8: Financial Summary
  // ═══════════════════════════════════════════════════

  pCtx = { ...pCtx, page, y };
  pCtx = startNewPage(pCtx);
  page = pCtx.page;
  y = pCtx.y;

  y = drawSectionHeader(page, fontBold, t.financialSummary, MARGIN, y);

  // By Cause
  y = drawSectionHeader(page, fontBold, t.byCause, MARGIN, y, COLOR.mid, 9);

  const causeCols: TableColumn[] = [
    { header: t.reasonCode, width: 150 },
    { header: 'Delays', width: 60 },
    { header: t.manHours, width: 80, align: 'right' },
    { header: t.cumulativeCost, width: 100, align: 'right' },
  ];

  y = drawTableHeader(page, fontBold, causeCols, MARGIN, y);

  for (const item of ctx.financialByCause) {
    pCtx = { ...pCtx, page, y };
    pCtx = addPageIfNeeded(pCtx, 20);
    page = pCtx.page;
    y = pCtx.y;

    y = drawTableRow(page, fontRegular, causeCols, [
      item.label,
      String(item.delayCount),
      `${item.manHours.toFixed(1)}`,
      formatCurrency(item.totalCost),
    ], MARGIN, y, 8);
  }

  y -= 12;

  // By Responsible Party
  if (ctx.financialByParty.length > 0) {
    y = drawSectionHeader(page, fontBold, t.byParty, MARGIN, y, COLOR.mid, 9);

    const partyCols: TableColumn[] = [
      { header: t.trade, width: 150 },
      { header: 'Delays', width: 60 },
      { header: t.manHours, width: 80, align: 'right' },
      { header: t.cumulativeCost, width: 100, align: 'right' },
    ];

    y = drawTableHeader(page, fontBold, partyCols, MARGIN, y);

    for (const item of ctx.financialByParty) {
      pCtx = { ...pCtx, page, y };
      pCtx = addPageIfNeeded(pCtx, 20);
      page = pCtx.page;
      y = pCtx.y;

      y = drawTableRow(page, fontRegular, partyCols, [
        item.label,
        String(item.delayCount),
        `${item.manHours.toFixed(1)}`,
        formatCurrency(item.totalCost),
      ], MARGIN, y, 8);
    }
  }

  // Grand total
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 8 },
    thickness: 0.5,
    color: COLOR.dark,
  });
  const totalStr = formatCurrency(ctx.grandTotal);
  const totalWidth = fontBold.widthOfTextAtSize(totalStr, 12);
  page.drawText(`${t.grandTotal}:`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR.dark,
  });
  page.drawText(totalStr, {
    x: PAGE_WIDTH - MARGIN - totalWidth,
    y,
    size: 12,
    font: fontBold,
    color: COLOR.accent,
  });
  y -= 24;

  // ═══════════════════════════════════════════════════
  // Signature
  // ═══════════════════════════════════════════════════

  pCtx = { ...pCtx, page, y };
  pCtx = addPageIfNeeded(pCtx, 100);
  page = pCtx.page;
  y = pCtx.y;

  if (signature) {
    y = await embedSignatureBlock(doc, page, fonts, signature, ctx.user.name, locale, y);
  }

  // ═══════════════════════════════════════════════════
  // Footer on all pages (with SHA-256 hash)
  // ═══════════════════════════════════════════════════

  const tempBytes = await doc.save();
  const hash = await computePdfHash(tempBytes);
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawFooterWithHash(pages[i], fonts, ctx.documentId, hash, locale, i + 1, pages.length);
  }

  return doc.save();
}
