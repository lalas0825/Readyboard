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

// ─── Escalation Check ──────────────────────────────

/**
 * Checks for documents that need escalation:
 *
 * 1. Opened 48h+ ago with no corrective action → sub should escalate
 * 2. Sent 72h+ ago and never opened → sub should follow up
 *
 * Creates notification records for sub PM/superintendent.
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

  if (openedDocs) {
    for (const doc of openedDocs) {
      // Check if a corrective action exists for any delay linked to this area/trade
      const { count } = await supabase
        .from('corrective_actions')
        .select('id', { count: 'exact', head: true })
        .eq('delay_logs.areas.project_id', projectId)
        .gte('created_at', doc.first_opened_at!);

      if ((count ?? 0) === 0) {
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

  // ── 3. Insert notifications ───────────────────────

  if (notifications.length > 0) {
    const notifRecords = notifications.map((n) => ({
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

    // Upsert-like: only insert if no recent notification for same document
    for (const record of notifRecords) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', record.user_id)
        .eq('type', record.type)
        .contains('data', { documentId: (record.data as Record<string, unknown>).documentId })
        .gte('created_at', new Date(now.getTime() - 24 * 3_600_000).toISOString());

      if ((count ?? 0) === 0) {
        await supabase.from('notifications').insert(record);
      }
    }
  }

  return { escalated: notifications.length, notifications };
}
