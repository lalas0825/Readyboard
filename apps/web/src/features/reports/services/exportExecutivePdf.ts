'use server';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateExecutiveReport } from './generateExecutiveReport';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import type { ExecutiveReportData } from '../types';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 16;

/**
 * Generates an executive report PDF and uploads to Supabase Storage.
 * Clean and dense — GC sees "what's wrong" in <10 seconds.
 */
export async function exportExecutivePdf(
  projectId: string,
): Promise<{ ok: true; pdfUrl: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  // Generate report data
  const result = await generateExecutiveReport(projectId);
  if (!result.ok) return result;

  const report = result.data;

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawText = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    const f = opts?.bold ? fontBold : font;
    const size = opts?.size ?? 10;
    const color = opts?.color ? rgb(...opts.color) : rgb(0.15, 0.15, 0.15);
    page.drawText(text, { x: MARGIN, y, font: f, size, color });
    y -= LINE_HEIGHT;
    if (y < MARGIN + 40) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawLine = () => {
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 8;
  };

  const drawKV = (key: string, value: string) => {
    page.drawText(key, { x: MARGIN, y, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: MARGIN + 160, y, font, size: 10, color: rgb(0.15, 0.15, 0.15) });
    y -= LINE_HEIGHT;
  };

  // ─── Header ───
  drawText('EXECUTIVE STATUS REPORT', { bold: true, size: 16 });
  y -= 4;
  drawText(report.project.name, { bold: true, size: 12 });
  if (report.project.address) {
    drawText(report.project.address, { size: 9, color: [0.5, 0.5, 0.5] });
  }
  drawText(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`, { size: 8, color: [0.5, 0.5, 0.5] });
  y -= 8;
  drawLine();

  // ─── Project Status ───
  drawText('PROJECT STATUS', { bold: true, size: 11 });
  y -= 2;
  drawKV('Overall Progress', `${report.project.overallPct.toFixed(1)}%`);
  drawKV('Total Areas', `${report.project.totalAreas}`);
  drawKV('On Track', `${report.project.areasOnTrack}`);
  drawKV('At Risk', `${report.project.areasAtRisk}`);
  y -= 4;
  drawLine();

  // ─── Schedule Delta ───
  drawText('SCHEDULE', { bold: true, size: 11 });
  y -= 2;
  drawKV('Baseline Finish', report.schedule.scheduledFinish ?? 'Not set');
  drawKV('Projected Finish', report.schedule.projectedFinish ?? 'Insufficient data');
  const deltaStr = report.schedule.deltaDays != null
    ? `${report.schedule.deltaDays > 0 ? '+' : ''}${report.schedule.deltaDays} days`
    : 'N/A';
  drawKV('Schedule Delta', deltaStr);
  drawKV('Critical Path Items', `${report.schedule.criticalPathItems}`);
  drawKV('Manual Overrides', `${report.schedule.manualOverrides}`);
  y -= 4;
  drawLine();

  // ─── Top 3 Risks ───
  drawText('TOP RISKS', { bold: true, size: 11 });
  y -= 2;
  if (report.topRisks.length === 0) {
    drawText('No schedule items currently at risk.', { size: 9, color: [0.4, 0.4, 0.4] });
  } else {
    for (const risk of report.topRisks) {
      const critical = risk.isCritical ? ' [CRITICAL PATH]' : '';
      drawText(`${risk.areaName} — ${risk.tradeName}${critical}`, { bold: true, size: 10 });
      drawText(`  +${risk.deltaDays}d behind  |  Baseline: ${risk.baselineFinish ?? '?'}  |  Projected: ${risk.projectedDate ?? '?'}`, { size: 9 });
      y -= 2;
    }
  }
  y -= 4;
  drawLine();

  // ─── Financial Impact ───
  drawText('FINANCIAL IMPACT', { bold: true, size: 11 });
  y -= 2;
  drawKV('Total Delay Cost', `$${report.financial.totalDelayCost.toLocaleString()}`);
  drawKV('Approved COs', `$${report.financial.totalApprovedCOs.toLocaleString()}`);
  drawKV('Pending COs', `$${report.financial.totalPendingCOs.toLocaleString()}`);
  drawKV('Total Financial Impact', `$${report.financial.totalFinancialImpact.toLocaleString()}`);
  drawKV('Active Delays', `${report.financial.activeDelays}`);
  y -= 4;
  drawLine();

  // ─── Active Delays ───
  if (report.activeDelays.length > 0) {
    drawText('ACTIVE DELAYS', { bold: true, size: 11 });
    y -= 2;
    for (const d of report.activeDelays.slice(0, 5)) {
      const legal = d.legalStatus ? ` [${d.legalStatus.toUpperCase()}]` : '';
      drawText(`${d.areaName} — ${d.tradeName} — ${d.reasonCode}${legal}`, { bold: true, size: 9 });
      drawText(`  ${d.daysBlocked}d blocked  |  $${d.dailyCost.toLocaleString()}/day  |  $${d.cumulativeCost.toLocaleString()} total`, { size: 8 });
      y -= 2;
    }
  }

  // ─── Footer ───
  y -= 8;
  drawText('ReadyBoard — Executive Report', { size: 7, color: [0.6, 0.6, 0.6] });

  // ─── Upload ───
  const pdfBytes = await pdfDoc.save();
  const supabase = createServiceClient();
  const fileName = `${projectId}/reports/executive_${new Date().toISOString().split('T')[0]}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('legal-docs')
    .upload(fileName, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: `PDF upload failed: ${uploadError.message}` };
  }

  const { data: urlData } = supabase.storage.from('legal-docs').getPublicUrl(fileName);

  return { ok: true, pdfUrl: urlData.publicUrl };
}
