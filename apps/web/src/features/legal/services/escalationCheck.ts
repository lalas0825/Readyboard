'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Types ──────────────────────────────────────────

export type EscalationNotification = {
  userId: string;
  documentId: string;
  type: 'opened_no_response' | 'never_opened';
  documentType: string;
  areaName: string;
  tradeName: string;
  hoursSinceEvent: number;
};

export type EscalationResult = {
  escalated: number;
  notifications: EscalationNotification[];
};

// ─── Constants ──────────────────────────────────────

const RESPONSE_WINDOW_HOURS = 48;
const NEVER_OPENED_WINDOW_HOURS = 72;
const ANTI_SPAM_WINDOW_HOURS = 24;

// ─── Escalation Check ──────────────────────────────

/**
 * Checks for documents that need escalation:
 *
 * 1. Opened 48h+ ago with no corrective action → sub should escalate
 * 2. Sent 72h+ ago and never opened → sub should follow up
 *
 * Creates notification records for sub PM/superintendent.
 * Batched queries — no N+1 loops.
 */
export async function checkEscalations(
  projectId: string,
): Promise<EscalationResult> {
  const session = await getSession();
  if (!session) return { escalated: 0, notifications: [] };

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const now = new Date();
  const notifications: EscalationNotification[] = [];

  // ── 1. Opened but no corrective action in 48h ────

  const responseDeadline = new Date(now.getTime() - RESPONSE_WINDOW_HOURS * 3_600_000).toISOString();

  const { data: openedDocs } = await supabase
    .from('legal_documents')
    .select(`
      id, type, first_opened_at, area_id, trade_name,
      areas ( name )
    `)
    .eq('project_id', projectId)
    .in('type', ['nod', 'rea'])
    .not('first_opened_at', 'is', null)
    .lt('first_opened_at', responseDeadline);

  if (openedDocs && openedDocs.length > 0) {
    // Batch: check if ANY corrective action exists for this project since earliest opened_at
    const earliestOpenedAt = openedDocs.reduce((min, d) => {
      const t = new Date(d.first_opened_at!).getTime();
      return t < min ? t : min;
    }, Infinity);

    const { count: caCount } = await supabase
      .from('corrective_actions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(earliestOpenedAt).toISOString());

    // If zero CAs exist since earliest document open, all docs are escalation-worthy
    // If CAs exist, we still flag docs — the presence of ANY CA doesn't mean all are covered
    // Simple heuristic: if CA count < opened doc count, flag all (conservative approach)
    if ((caCount ?? 0) < openedDocs.length) {
      for (const doc of openedDocs) {
        const area = doc.areas as unknown as Record<string, unknown>;
        const hoursSince = (now.getTime() - new Date(doc.first_opened_at!).getTime()) / 3_600_000;

        notifications.push({
          userId: session.user.id,
          documentId: doc.id,
          type: 'opened_no_response',
          documentType: doc.type,
          areaName: (area?.name as string) ?? 'Unknown',
          tradeName: doc.trade_name ?? 'Unknown',
          hoursSinceEvent: Math.round(hoursSince),
        });
      }
    }
  }

  // ── 2. Never opened after 72h ─────────────────────

  const neverOpenedDeadline = new Date(now.getTime() - NEVER_OPENED_WINDOW_HOURS * 3_600_000).toISOString();

  const { data: unopenedDocs } = await supabase
    .from('legal_documents')
    .select(`
      id, type, sent_at, area_id, trade_name,
      areas ( name )
    `)
    .eq('project_id', projectId)
    .in('type', ['nod', 'rea'])
    .is('first_opened_at', null)
    .not('sent_at', 'is', null)
    .lt('sent_at', neverOpenedDeadline);

  if (unopenedDocs) {
    for (const doc of unopenedDocs) {
      const area = doc.areas as unknown as Record<string, unknown>;
      const hoursSince = (now.getTime() - new Date(doc.sent_at!).getTime()) / 3_600_000;

      notifications.push({
        userId: session.user.id,
        documentId: doc.id,
        type: 'never_opened',
        documentType: doc.type,
        areaName: (area?.name as string) ?? 'Unknown',
        tradeName: doc.trade_name ?? 'Unknown',
        hoursSinceEvent: Math.round(hoursSince),
      });
    }
  }

  // ── 3. Batch insert notifications (anti-spam) ─────

  if (notifications.length > 0) {
    const antiSpamCutoff = new Date(now.getTime() - ANTI_SPAM_WINDOW_HOURS * 3_600_000).toISOString();

    // Batch anti-spam: fetch ALL recent escalation notifications in one query
    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('data, type')
      .eq('user_id', session.user.id)
      .in('type', ['legal_escalation', 'legal_follow_up'])
      .gte('created_at', antiSpamCutoff);

    const notifiedDocIds = new Set(
      (recentNotifs ?? []).map((n) => (n.data as Record<string, unknown>)?.documentId),
    );

    // Filter to only notifications not already sent in 24h
    const newNotifications = notifications.filter((n) => !notifiedDocIds.has(n.documentId));

    if (newNotifications.length > 0) {
      const notifRecords = newNotifications.map((n) => ({
        user_id: n.userId,
        type: n.type === 'opened_no_response' ? 'legal_escalation' : 'legal_follow_up',
        title: n.type === 'opened_no_response'
          ? `${n.documentType.toUpperCase()} opened ${n.hoursSinceEvent}h ago — no GC response`
          : `${n.documentType.toUpperCase()} sent ${n.hoursSinceEvent}h ago — never opened`,
        body: `${n.areaName} — ${n.tradeName}`,
        data: {
          documentId: n.documentId,
          escalationType: n.type,
          hoursSinceEvent: n.hoursSinceEvent,
        },
      }));

      // Batch insert all at once
      await supabase.from('notifications').insert(notifRecords);
    }
  }

  return { escalated: notifications.length, notifications };
}
