'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { MS_PER_HOUR } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────

export type LegalStatus = 'pending' | 'draft' | 'sent' | 'signed';

export type ThresholdResult = {
  delayLogId: string;
  areaName: string;
  tradeName: string;
  durationHours: number;
  cumulativeCost: number;
  manHours: number;
  /** Which legal documents this delay qualifies for */
  triggers: LegalTrigger[];
};

export type LegalTrigger = {
  type: 'nod' | 'rea';
  reason: string;
  threshold: number;
  actual: number;
};

export type ThresholdScanResult = {
  /** Delays that already have legal_status = 'pending' (awaiting GC action) */
  pendingReview: ThresholdResult[];
  /** Delays that just crossed a threshold and were marked 'pending' */
  newlyFlagged: ThresholdResult[];
  /** Delays that are legally locked (draft/sent/signed) */
  locked: { delayLogId: string; legalStatus: LegalStatus }[];
  /** Number of draft NODs auto-generated in this scan */
  draftsGenerated: number;
};

// ─── Engine ─────────────────────────────────────────

/**
 * Scans all active delay_logs for a project and evaluates legal thresholds.
 *
 * For delays that cross a threshold and have no legal_status yet:
 * - Sets legal_status = 'pending'
 * - Returns them as `newlyFlagged` so the dashboard can notify the GC
 *
 * The GC must manually authorize draft creation. The system suggests,
 * the human executes.
 */
export async function scanThresholds(
  projectId: string,
): Promise<ThresholdScanResult> {
  const session = await getSession();
  if (!session) {
    return { pendingReview: [], newlyFlagged: [], locked: [], draftsGenerated: 0 };
  }

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Get project thresholds
  const { data: project } = await supabase
    .from('projects')
    .select('labor_rate_per_hour, nod_threshold_hours, rea_threshold_cost, rea_threshold_crew_days')
    .eq('id', projectId)
    .single();

  if (!project) {
    return { pendingReview: [], newlyFlagged: [], locked: [], draftsGenerated: 0 };
  }

  const nodThresholdHours = Number(project.nod_threshold_hours ?? 24);
  const reaThresholdCost = Number(project.rea_threshold_cost ?? 5000);
  const reaThresholdCrewDays = Number(project.rea_threshold_crew_days ?? 3);
  const laborRate = Number(project.labor_rate_per_hour ?? 0);

  // Get all delay logs for this project (active + closed, excluding signed)
  const { data: logs, error } = await supabase
    .from('delay_logs')
    .select(`
      id, area_id, trade_name, reason_code, crew_size,
      started_at, ended_at, man_hours, cumulative_cost, legal_status,
      areas!inner ( name, floor, project_id )
    `)
    .eq('areas.project_id', projectId)
    .order('started_at', { ascending: false });

  if (error || !logs) {
    return { pendingReview: [], newlyFlagged: [], locked: [], draftsGenerated: 0 };
  }

  const pendingReview: ThresholdResult[] = [];
  const newlyFlagged: ThresholdResult[] = [];
  const locked: { delayLogId: string; legalStatus: LegalStatus }[] = [];
  const toMarkPending: string[] = [];

  const now = Date.now();

  for (const log of logs) {
    const area = log.areas as unknown as Record<string, unknown>;
    const areaName = (area.name as string) ?? 'Unknown';
    const crewSize = log.crew_size ?? 1;

    // Already locked — skip evaluation
    if (log.legal_status === 'draft' || log.legal_status === 'sent' || log.legal_status === 'signed') {
      locked.push({ delayLogId: log.id, legalStatus: log.legal_status as LegalStatus });
      continue;
    }

    // Calculate real-time values for active delays
    const isActive = !log.ended_at;
    let durationHours: number;
    let manHours: number;
    let cumulativeCost: number;

    if (isActive) {
      durationHours = (now - new Date(log.started_at).getTime()) / MS_PER_HOUR;
      manHours = Math.round(durationHours * crewSize * 100) / 100;
      cumulativeCost = Math.round(manHours * laborRate * 100) / 100;
    } else {
      durationHours = Number(log.man_hours) / crewSize;
      manHours = Number(log.man_hours);
      cumulativeCost = Number(log.cumulative_cost);
    }

    // Evaluate thresholds
    const triggers: LegalTrigger[] = [];

    // NOD threshold: duration exceeds X hours
    if (durationHours >= nodThresholdHours) {
      triggers.push({
        type: 'nod',
        reason: `Delay exceeds ${nodThresholdHours}h threshold`,
        threshold: nodThresholdHours,
        actual: Math.round(durationHours * 100) / 100,
      });
    }

    // REA threshold: cumulative cost
    if (cumulativeCost >= reaThresholdCost) {
      triggers.push({
        type: 'rea',
        reason: `Cumulative cost ($${cumulativeCost.toFixed(2)}) exceeds $${reaThresholdCost} threshold`,
        threshold: reaThresholdCost,
        actual: cumulativeCost,
      });
    }

    // REA threshold: crew-days (crew_size × days)
    const crewDays = (durationHours / 8) * crewSize;
    if (crewDays >= reaThresholdCrewDays) {
      triggers.push({
        type: 'rea',
        reason: `${crewDays.toFixed(1)} crew-days exceeds ${reaThresholdCrewDays} crew-day threshold`,
        threshold: reaThresholdCrewDays,
        actual: Math.round(crewDays * 10) / 10,
      });
    }

    if (triggers.length === 0) continue;

    const result: ThresholdResult = {
      delayLogId: log.id,
      areaName,
      tradeName: log.trade_name,
      durationHours: Math.round(durationHours * 100) / 100,
      cumulativeCost,
      manHours,
      triggers,
    };

    if (log.legal_status === 'pending') {
      pendingReview.push(result);
    } else {
      // legal_status is NULL — flag it
      newlyFlagged.push(result);
      toMarkPending.push(log.id);
    }
  }

  // Batch-mark newly flagged delays as 'pending'
  if (toMarkPending.length > 0) {
    await supabase
      .from('delay_logs')
      .update({ legal_status: 'pending' })
      .in('id', toMarkPending);
  }

  // Auto-generate draft NODs for newly flagged delays (fire-and-forget)
  let draftsGenerated = 0;
  if (newlyFlagged.length > 0) {
    const { generateNodDraft } = await import('./nodAutoGen');
    for (const flagged of newlyFlagged) {
      try {
        const result = await generateNodDraft(flagged.delayLogId);
        if (result.ok) draftsGenerated++;
      } catch {
        // Draft generation failure does NOT block scan results
      }
    }
  }

  return { pendingReview, newlyFlagged, locked, draftsGenerated };
}

export type AuthorizeDraftResult =
  | {
      ok: true;
      snapshot: {
        manHours: number;
        dailyCost: number;
        cumulativeCost: number;
      };
      /** Pre-computed storage path for evidence upload */
      storagePath: string;
      /** Whether the user's client can write to the legal-docs bucket */
      storageReady: boolean;
    }
  | { ok: false; error: string };

/**
 * GC explicitly authorizes a delay_log to progress to 'draft'.
 * This locks the delay_log — no further cost modifications allowed.
 *
 * Returns the finalized cost snapshot for document generation,
 * plus the storage path and write-readiness for evidence upload.
 */
export async function authorizeDraft(
  delayLogId: string,
): Promise<AuthorizeDraftResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Verify current status is 'pending' and get project context
  const { data: log } = await supabase
    .from('delay_logs')
    .select(`
      id, legal_status, man_hours, daily_cost, cumulative_cost,
      evidence_hash,
      areas!inner ( project_id )
    `)
    .eq('id', delayLogId)
    .single();

  if (!log) return { ok: false, error: 'Delay log not found' };
  if (log.legal_status !== 'pending') {
    return { ok: false, error: `Cannot authorize draft: current status is '${log.legal_status}'` };
  }
  if (log.evidence_hash) {
    return { ok: false, error: 'Evidence already exists for this delay log.' };
  }

  const area = log.areas as unknown as Record<string, unknown>;
  const projectId = area.project_id as string;
  const storagePath = `${projectId}/${delayLogId}/evidence.pdf`;

  // Progress to 'draft' — this triggers immutability
  const { error } = await supabase
    .from('delay_logs')
    .update({ legal_status: 'draft' })
    .eq('id', delayLogId);

  if (error) return { ok: false, error: error.message };

  // Verify storage bucket is accessible (list check)
  let storageReady = false;
  const { error: storageError } = await supabase.storage
    .from('legal-docs')
    .list(projectId, { limit: 1 });

  storageReady = !storageError;

  return {
    ok: true,
    snapshot: {
      manHours: Number(log.man_hours),
      dailyCost: Number(log.daily_cost),
      cumulativeCost: Number(log.cumulative_cost),
    },
    storagePath,
    storageReady,
  };
}
