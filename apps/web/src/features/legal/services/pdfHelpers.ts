// ─── Shared PDF Drawing Utilities ──────────────────────────
// Reusable across NOD, REA, and Evidence Package PDF builders.
// All builders import from here — no duplicated drawing logic.

import { PDFDocument, PDFPage, PDFFont, rgb, PageSizes } from 'pdf-lib';
import type { PdfLocale, PdfTexts } from './pdfTexts';
import { PDF_TEXTS } from './pdfTexts';
import type { SignatureInput } from './evidenceStorage';

// ─── Constants ──────────────────────────────────────────────

export const MARGIN = 50;
export const PAGE_WIDTH = PageSizes.Letter[0]; // 612
export const PAGE_HEIGHT = PageSizes.Letter[1]; // 792
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
export const LINE_HEIGHT = 16;
export const FOOTER_HEIGHT = 60;

export const COLOR = {
  black: rgb(0.067, 0.067, 0.067),
  dark: rgb(0.2, 0.2, 0.2),
  mid: rgb(0.4, 0.4, 0.4),
  light: rgb(0.6, 0.6, 0.6),
  line: rgb(0.85, 0.85, 0.85),
  accent: rgb(0.72, 0.53, 0.04), // Amber-700
  red: rgb(0.8, 0.2, 0.2),
  green: rgb(0.15, 0.6, 0.15),
};

// ─── Page Management ────────────────────────────────────────

export type PageContext = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fontBold: PDFFont;
  fontRegular: PDFFont;
  pageNumber: number;
};

/**
 * Checks if we need a new page. If y drops below the footer zone, adds a page.
 * Returns updated context with new page (or same page if still fits).
 */
export function addPageIfNeeded(
  ctx: PageContext,
  requiredSpace: number = LINE_HEIGHT * 2,
): PageContext {
  if (ctx.y - requiredSpace < MARGIN + FOOTER_HEIGHT) {
    const newPage = ctx.doc.addPage(PageSizes.Letter);
    return {
      ...ctx,
      page: newPage,
      y: PAGE_HEIGHT - MARGIN,
      pageNumber: ctx.pageNumber + 1,
    };
  }
  return ctx;
}

/**
 * Force a new page (for section breaks in Evidence Package).
 */
export function startNewPage(ctx: PageContext): PageContext {
  const newPage = ctx.doc.addPage(PageSizes.Letter);
  return {
    ...ctx,
    page: newPage,
    y: PAGE_HEIGHT - MARGIN,
    pageNumber: ctx.pageNumber + 1,
  };
}

// ─── Drawing Primitives ─────────────────────────────────────

/**
 * Draws a label:value pair. Returns new y position.
 */
export function drawLabelValue(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number = 120,
): number {
  page.drawText(`${label}:`, {
    x,
    y,
    size: 9,
    font: fontBold,
    color: COLOR.mid,
  });
  page.drawText(value, {
    x: x + labelWidth,
    y,
    size: 10,
    font: fontRegular,
    color: COLOR.dark,
  });
  return y - LINE_HEIGHT;
}

/**
 * Draws a bold section header. Returns new y position.
 */
export function drawSectionHeader(
  page: PDFPage,
  fontBold: PDFFont,
  title: string,
  x: number,
  y: number,
  color = COLOR.black,
  size: number = 11,
): number {
  page.drawText(title, { x, y, size, font: fontBold, color });
  return y - 20;
}

/**
 * Draws a horizontal divider line. Returns new y position.
 */
export function drawDivider(
  page: PDFPage,
  y: number,
  thickness: number = 0.5,
  color = COLOR.line,
): number {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness,
    color,
  });
  return y - (thickness > 1 ? 24 : 12);
}

/**
 * Draws the accent divider (thick amber line used in headers).
 */
export function drawAccentDivider(page: PDFPage, y: number): number {
  return drawDivider(page, y, 1.5, COLOR.accent);
}

// ─── Footer ─────────────────────────────────────────────────

/**
 * Draws the tamper-evident footer with SHA-256 hash and verification URL.
 * Called on every page of multi-page documents.
 */
export function drawFooterWithHash(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  documentId: string,
  hash: string | null,
  locale: PdfLocale,
  pageNum?: number,
  totalPages?: number,
): void {
  const t = PDF_TEXTS[locale].footer;
  const footerY = MARGIN + 30;

  page.drawLine({
    start: { x: MARGIN, y: footerY + 16 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 16 },
    thickness: 0.5,
    color: COLOR.line,
  });

  page.drawText(t.tamperEvident, {
    x: MARGIN,
    y: footerY,
    size: 7,
    font: fonts.bold,
    color: COLOR.light,
  });

  page.drawText(`${t.documentId}: ${documentId}`, {
    x: MARGIN,
    y: footerY - 11,
    size: 7,
    font: fonts.regular,
    color: COLOR.light,
  });

  page.drawText(`${t.generated}: ${new Date().toISOString()}`, {
    x: MARGIN,
    y: footerY - 22,
    size: 7,
    font: fonts.regular,
    color: COLOR.light,
  });

  const hashLine = hash
    ? `SHA-256: ${hash}`
    : `${t.verifyAt}: readyboard.app/api/legal/verify`;

  page.drawText(hashLine, {
    x: MARGIN,
    y: footerY - 33,
    size: 6,
    font: fonts.regular,
    color: COLOR.light,
  });

  // Page number (right-aligned)
  if (pageNum != null && totalPages != null) {
    const texts = PDF_TEXTS[locale];
    const pageText = `${texts.page} ${pageNum} ${texts.of} ${totalPages}`;
    const textWidth = fonts.regular.widthOfTextAtSize(pageText, 7);
    page.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN - textWidth,
      y: footerY,
      size: 7,
      font: fonts.regular,
      color: COLOR.light,
    });
  }
}

// ─── Signature Block ────────────────────────────────────────

/**
 * Embeds a signature block (PNG image + metadata). Returns new y position.
 * Extracted from pdfAssembler.ts for reuse across all PDF types.
 */
export async function embedSignatureBlock(
  doc: PDFDocument,
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  signature: SignatureInput,
  userName: string,
  locale: PdfLocale,
  y: number,
): Promise<number> {
  const t = PDF_TEXTS[locale];

  page.drawText(t.authorizedBy, {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.bold,
    color: COLOR.black,
  });
  y -= 16;

  // Embed signature PNG
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

  page.drawText(userName, {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.regular,
    color: COLOR.dark,
  });

  page.drawText(`${t.signed}: ${formatDate(signature.metadata.capturedAt, locale)}`, {
    x: MARGIN + sigMaxWidth + 20,
    y,
    size: 8,
    font: fonts.regular,
    color: COLOR.mid,
  });
  y -= 14;

  page.drawText(
    `${signature.metadata.strokeCount} ${t.strokes}, ${signature.metadata.totalPoints} ${t.pointsCaptured}`,
    {
      x: MARGIN,
      y,
      size: 7,
      font: fonts.regular,
      color: COLOR.light,
    },
  );
  y -= 16;

  return y;
}

/**
 * Draws draft watermark section. Returns new y position.
 */
export function drawDraftWatermark(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  userName: string,
  locale: PdfLocale,
  y: number,
): number {
  const t = PDF_TEXTS[locale];

  page.drawText(t.draftWatermark, {
    x: MARGIN,
    y,
    size: 16,
    font: fonts.bold,
    color: COLOR.red,
  });
  y -= 24;

  page.drawText(t.draftNote, {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.regular,
    color: COLOR.mid,
  });
  y -= 14;

  page.drawText(`${t.preparedFor}: ${userName}`, {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.regular,
    color: COLOR.dark,
  });
  y -= 16;

  return y;
}

// ─── Table Drawing ──────────────────────────────────────────

export type TableColumn = {
  header: string;
  width: number;
  align?: 'left' | 'right';
};

/**
 * Draws a table header row. Returns new y position.
 */
export function drawTableHeader(
  page: PDFPage,
  fontBold: PDFFont,
  columns: TableColumn[],
  x: number,
  y: number,
): number {
  let cx = x;
  for (const col of columns) {
    page.drawText(col.header, {
      x: cx,
      y,
      size: 8,
      font: fontBold,
      color: COLOR.mid,
    });
    cx += col.width;
  }
  y -= 4;
  page.drawLine({
    start: { x, y },
    end: { x: x + columns.reduce((s, c) => s + c.width, 0), y },
    thickness: 0.5,
    color: COLOR.line,
  });
  return y - 12;
}

/**
 * Draws a table data row. Returns new y position.
 */
export function drawTableRow(
  page: PDFPage,
  fontRegular: PDFFont,
  columns: TableColumn[],
  values: string[],
  x: number,
  y: number,
  size: number = 8,
): number {
  let cx = x;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const val = values[i] ?? '';
    const textX = col.align === 'right'
      ? cx + col.width - fontRegular.widthOfTextAtSize(val, size) - 4
      : cx;
    page.drawText(val, {
      x: textX,
      y,
      size,
      font: fontRegular,
      color: COLOR.dark,
    });
    cx += col.width;
  }
  return y - 14;
}

// ─── Formatting Utilities ───────────────────────────────────

/**
 * Locale-aware date formatting.
 */
export function formatDate(iso: string, locale: PdfLocale = 'en'): string {
  const d = new Date(iso);
  return d.toLocaleString(locale === 'es' ? 'es-US' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Short date (no time).
 */
export function formatDateShort(iso: string, locale: PdfLocale = 'en'): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Currency formatting: $1,234.56
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format reason code using locale dictionary.
 */
export function formatReasonCode(code: string, locale: PdfLocale = 'en'): string {
  return PDF_TEXTS[locale].reasonCodes[code] ?? code;
}

/**
 * Calculate duration in hours between two dates.
 */
export function calculateDurationHours(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return (end - start) / 3_600_000;
}

// ─── SHA-256 ────────────────────────────────────────────────

/**
 * Computes SHA-256 hash of PDF bytes using Web Crypto API.
 */
export async function computePdfHash(pdfBytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(buffer).set(pdfBytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
