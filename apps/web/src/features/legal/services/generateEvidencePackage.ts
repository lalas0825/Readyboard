'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';
import { buildEvidencePackagePdf } from './evidencePackageBuilder';
import type {
  EvidenceDelay,
  EvidenceNod,
  EvidenceRea,
  EvidenceFieldReport,
  EvidenceCa,
  FinancialSummaryItem,
  EvidencePackageContext,
} from './evidencePackageBuilder';
import type { SignatureInput } from './evidenceStorage';
import type { PdfLocale } from './pdfTexts';
import { computePdfHash, formatReasonCode } from './pdfHelpers';

// ─── Types ──────────────────────────────────────────

export type GenerateEvidencePackageInput = {
  projectId: string;
  areaId?: string;
  tradeName?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  signature: SignatureInput;
  locale?: PdfLocale;
};

export type GenerateEvidencePackageResult =
  | { ok: true; docId: string; hash: string }
  | { ok: false; error: string };

// ─── Constants ──────────────────────────────────────

const BUCKET = 'legal-docs';

// ─── Generate Evidence Package ──────────────────────

/**
 * Generates an arbitration-ready evidence package PDF.
 *
 * Flow:
 * 1. Auth check
 * 2. Parallel data fetch (each in try/catch)
 * 3. Build financial summary
 * 4. Build PDF → hash
 * 5. Upload to storage
 * 6. Create legal_documents record
 * 7. Audit entry — revert on failure
 */
export async function generateEvidencePackage(
  input: GenerateEvidencePackageInput,
): Promise<GenerateEvidencePackageResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const locale = input.locale ?? 'en';

  // ── 1. Fetch project ──────────────────────────────

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id, name, address, legal_jurisdiction, labor_rate_per_hour,
      gc_org:organizations!projects_gc_org_id_fkey ( name )
    `)
    .eq('id', input.projectId)
    .single();

  if (!project) return { ok: false, error: 'Project not found' };

  const gcOrg = project.gc_org as unknown as Record<string, unknown>;

  // ── 2. Parallel data fetches ──────────────────────

  // Build base filter for delay_logs
  let delayQuery = supabase
    .from('delay_logs')
    .select(`
      id, trade_name, reason_code, crew_size,
      started_at, ended_at, man_hours, daily_cost, cumulative_cost,
      areas!inner ( name, floor, project_id )
    `)
    .eq('areas.project_id', input.projectId);

  if (input.areaId) delayQuery = delayQuery.eq('area_id', input.areaId);
  if (input.tradeName) delayQuery = delayQuery.eq('trade_name', input.tradeName);
  if (input.dateRangeStart) delayQuery = delayQuery.gte('started_at', input.dateRangeStart);
  if (input.dateRangeEnd) delayQuery = delayQuery.lte('started_at', input.dateRangeEnd);

  const [delaysRes, nodsRes, reasRes, reportsRes, casRes] = await Promise.all([
    // Delays
    delayQuery,

    // NODs with receipts
    supabase
      .from('legal_documents')
      .select(`
        id, sha256_hash, first_opened_at, open_count, sent_at,
        area_id, trade_name,
        areas ( name ),
        receipt_events ( ip_address, device_type, opened_at )
      `)
      .eq('project_id', input.projectId)
      .eq('type', 'nod')
      .not('sent_at', 'is', null),

    // REAs
    supabase
      .from('legal_documents')
      .select(`
        id, total_claim_amount, sha256_hash, generated_at,
        rea_delay_links ( id )
      `)
      .eq('project_id', input.projectId)
      .eq('type', 'rea'),

    // Field reports (GPS + photos)
    supabase
      .from('field_reports')
      .select(`
        id, trade_name, gps_lat, gps_lng, device_id, photo_url,
        created_at, offline_created_at,
        areas!inner ( name, project_id )
      `)
      .eq('areas.project_id', input.projectId)
      .order('created_at', { ascending: true }),

    // Corrective actions
    supabase
      .from('corrective_actions')
      .select(`
        id, note, created_at, acknowledged_at, in_resolution_at, resolved_at,
        delay_logs!inner (
          trade_name,
          areas!inner ( name, project_id )
        )
      `)
      .eq('delay_logs.areas.project_id', input.projectId),
  ]);

  // ── 3. Transform results ──────────────────────────

  const delays: EvidenceDelay[] = (delaysRes.data ?? []).map((d) => {
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

  const nods: EvidenceNod[] = (nodsRes.data ?? []).map((n) => {
    const area = n.areas as unknown as Record<string, unknown>;
    const events = n.receipt_events as unknown as Array<Record<string, unknown>>;
    return {
      id: n.id,
      areaName: (area?.name as string) ?? 'Unknown',
      tradeName: (n.trade_name as string) ?? 'Unknown',
      sentAt: n.sent_at!,
      sha256Hash: n.sha256_hash,
      firstOpenedAt: n.first_opened_at,
      openCount: n.open_count ?? 0,
      receiptEvents: (events ?? []).map((e) => ({
        ipAddress: (e.ip_address as string) ?? null,
        deviceType: (e.device_type as string) ?? null,
        openedAt: e.opened_at as string,
      })),
    };
  });

  const reas: EvidenceRea[] = (reasRes.data ?? []).map((r) => {
    const links = r.rea_delay_links as unknown as Array<Record<string, unknown>>;
    return {
      id: r.id,
      totalClaimAmount: Number(r.total_claim_amount ?? 0),
      sha256Hash: r.sha256_hash,
      generatedAt: r.generated_at ?? '',
      delayCount: links?.length ?? 0,
    };
  });

  const fieldReports: EvidenceFieldReport[] = (reportsRes.data ?? []).map((r) => {
    const area = r.areas as unknown as Record<string, unknown>;
    return {
      id: r.id,
      areaName: (area.name as string) ?? 'Unknown',
      tradeName: r.trade_name,
      gpsLat: r.gps_lat != null ? Number(r.gps_lat) : null,
      gpsLng: r.gps_lng != null ? Number(r.gps_lng) : null,
      deviceId: r.device_id,
      photoUrl: r.photo_url,
      createdAt: r.created_at,
      offlineCreatedAt: r.offline_created_at,
    };
  });

  const correctiveActions: EvidenceCa[] = (casRes.data ?? []).map((ca) => {
    const dl = ca.delay_logs as unknown as Record<string, unknown>;
    const area = dl.areas as unknown as Record<string, unknown>;
    return {
      id: ca.id,
      areaName: (area?.name as string) ?? 'Unknown',
      tradeName: (dl.trade_name as string) ?? 'Unknown',
      note: ca.note,
      createdAt: ca.created_at,
      acknowledgedAt: ca.acknowledged_at,
      inResolutionAt: ca.in_resolution_at,
      resolvedAt: ca.resolved_at,
    };
  });

  // ── 4. Build financial summaries ──────────────────

  const financialByCause = buildFinancialByCause(delays, locale);
  const financialByParty = buildFinancialByTrade(delays);
  const grandTotal = delays.reduce((sum, d) => sum + d.cumulativeCost, 0);

  // Date range
  const allDates = delays.map((d) => new Date(d.startedAt).getTime());
  const dateRangeStart = input.dateRangeStart ?? (allDates.length > 0 ? new Date(Math.min(...allDates)).toISOString() : new Date().toISOString());
  const endDates = delays.filter((d) => d.endedAt).map((d) => new Date(d.endedAt!).getTime());
  const dateRangeEnd = input.dateRangeEnd ?? (endDates.length > 0 ? new Date(Math.max(...endDates)).toISOString() : new Date().toISOString());

  // ── 5. Create legal_documents record ──────────────

  const { data: legalDoc, error: insertError } = await supabase
    .from('legal_documents')
    .insert({
      project_id: input.projectId,
      org_id: session.user.org_id,
      type: 'evidence',
      total_claim_amount: grandTotal,
      locale,
      sent_at: new Date().toISOString(),
      sent_by: session.user.id,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !legalDoc) {
    return { ok: false, error: `Failed to create legal document: ${insertError?.message ?? 'unknown'}` };
  }

  const documentId = legalDoc.id;

  // ── 6. Build PDF ──────────────────────────────────

  const evidenceCtx: EvidencePackageContext = {
    project: {
      name: project.name,
      address: project.address ?? '',
      jurisdiction: project.legal_jurisdiction,
      laborRate: Number(project.labor_rate_per_hour),
    },
    org: {
      name: (gcOrg?.name as string) ?? 'Unknown Organization',
    },
    user: {
      name: session.user.name,
    },
    delays,
    nods,
    reas,
    fieldReports,
    correctiveActions,
    financialByCause,
    financialByParty,
    grandTotal,
    dateRangeStart,
    dateRangeEnd,
    documentId,
  };

  const pdfBytes = await buildEvidencePackagePdf(evidenceCtx, {
    signature: input.signature,
    locale,
  });

  const hash = await computePdfHash(pdfBytes);

  // ── 7. Upload PDF + signature ─────────────────────

  const pdfPath = `${input.projectId}/evidence/${documentId}/evidence.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    await supabase.from('legal_documents').delete().eq('id', documentId);
    return { ok: false, error: `PDF upload failed: ${uploadError.message}` };
  }

  // Upload signature
  let signaturePath: string | null = null;
  if (input.signature) {
    const base64 = input.signature.imageBase64.split(',')[1];
    const binary = atob(base64);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const sigPath = `${input.projectId}/evidence/${documentId}/signature.png`;
    const { error: sigError } = await supabase.storage
      .from(BUCKET)
      .upload(sigPath, sigBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (!sigError) signaturePath = sigPath;
  }

  // ── 8. Update document with hash + paths ──────────

  const { error: updateError } = await supabase
    .from('legal_documents')
    .update({
      sha256_hash: hash,
      pdf_url: pdfPath,
      signature_png_url: signaturePath,
    })
    .eq('id', documentId);

  if (updateError) {
    return { ok: false, error: `PDF uploaded but document update failed: ${updateError.message}` };
  }

  // ── 9. Audit entry (atomic — revert on failure) ───

  const audit = await writeAuditEntry({
    tableName: 'legal_documents',
    recordId: documentId,
    action: 'evidence_package_generated',
    changedBy: session.user.id,
    oldValue: null,
    newValue: {
      type: 'evidence',
      delay_count: delays.length,
      nod_count: nods.length,
      rea_count: reas.length,
      grand_total: grandTotal,
      sha256: hash,
    },
    reason: `Evidence package generated — ${delays.length} delays, ${nods.length} NODs, total ${grandTotal.toFixed(2)}, SHA-256: ${hash}`,
  });

  if (!audit.ok) {
    await supabase.from('legal_documents').delete().eq('id', documentId);
    return { ok: false, error: audit.error };
  }

  return { ok: true, docId: documentId, hash };
}

// ─── Helpers ────────────────────────────────────────

function buildFinancialByCause(delays: EvidenceDelay[], locale: PdfLocale): FinancialSummaryItem[] {
  const map = new Map<string, { totalCost: number; manHours: number; delayCount: number }>();

  for (const d of delays) {
    const existing = map.get(d.reasonCode) ?? { totalCost: 0, manHours: 0, delayCount: 0 };
    existing.totalCost += d.cumulativeCost;
    existing.manHours += d.manHours;
    existing.delayCount += 1;
    map.set(d.reasonCode, existing);
  }

  return Array.from(map.entries())
    .map(([key, val]) => ({
      key,
      label: formatReasonCode(key, locale),
      ...val,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

function buildFinancialByTrade(delays: EvidenceDelay[]): FinancialSummaryItem[] {
  const map = new Map<string, { totalCost: number; manHours: number; delayCount: number }>();

  for (const d of delays) {
    const existing = map.get(d.tradeName) ?? { totalCost: 0, manHours: 0, delayCount: 0 };
    existing.totalCost += d.cumulativeCost;
    existing.manHours += d.manHours;
    existing.delayCount += 1;
    map.set(d.tradeName, existing);
  }

  return Array.from(map.entries())
    .map(([key, val]) => ({
      key,
      label: key,
      ...val,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
