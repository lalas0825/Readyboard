'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { checkEscalations } from '@/features/legal/services/escalationCheck';
import { notifyProjectGC } from '@/lib/pushNotify';

const NOD_REMINDER_HOURS = 20;
const VERIFICATION_REMINDER_HOURS = 4;
const VERIFICATION_ESCALATION_HOURS = 24;
const ANTI_SPAM_WINDOW_MS = 24 * 3_600_000;

/**
 * Non-blocking notification trigger — runs as fire-and-forget side-effect.
 *
 * 1. Checks delay_logs > 20h old with no nod_draft → inserts 'nod_reminder'
 * 2. Delegates 48h/72h escalation to checkEscalations() from Week 6
 * 3. Anti-spam: batched check — skips if notification exists within 24h
 */
export async function notificationTrigger(projectId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const supabase = createServiceClient();
  const now = new Date();

  // ── 1. NOD Reminder (20h) ──────────────────────────
  try {
    const reminderCutoff = new Date(now.getTime() - NOD_REMINDER_HOURS * 3_600_000).toISOString();
    const antiSpamCutoff = new Date(now.getTime() - ANTI_SPAM_WINDOW_MS).toISOString();

    const { data: staleDelays } = await supabase
      .from('delay_logs')
      .select(`
        id, area_id, trade_name,
        areas!inner ( name, project_id )
      `)
      .eq('areas.project_id', projectId)
      .is('ended_at', null)
      .is('nod_draft_id', null)
      .lt('started_at', reminderCutoff);

    if (staleDelays && staleDelays.length > 0) {
      // Batch anti-spam: fetch ALL recent nod_reminder notifications in one query
      const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('data')
        .eq('user_id', session.user.id)
        .eq('type', 'nod_reminder')
        .gte('created_at', antiSpamCutoff);

      const notifiedDelayIds = new Set(
        (recentNotifs ?? []).map((n) => (n.data as Record<string, unknown>)?.delayLogId),
      );

      // Filter to only delays not already notified
      const delaysToNotify = staleDelays.filter((d) => !notifiedDelayIds.has(d.id));

      if (delaysToNotify.length > 0) {
        // Batch insert all notifications at once
        const records = delaysToNotify.map((delay) => {
          const area = delay.areas as unknown as Record<string, unknown>;
          return {
            user_id: session.user.id,
            type: 'nod_reminder',
            title: `NOD pending — ${(area.name as string) ?? 'Unknown'} · ${delay.trade_name}`,
            body: 'Delay has been active 20h+ without a Notice of Delay draft.',
            data: {
              delayLogId: delay.id,
              areaId: delay.area_id,
              tradeName: delay.trade_name,
            },
          };
        });

        await supabase.from('notifications').insert(records);

        // Push notification to GC team: blocked areas needing NOD
        void notifyProjectGC(
          projectId,
          `${delaysToNotify.length} Blocked Area${delaysToNotify.length > 1 ? 's' : ''} — NOD Pending`,
          `${delaysToNotify.map((d) => d.trade_name).join(', ')} blocked 20h+ without NOD.`,
          { screen: 'area', type: 'nod_reminder' },
        );
      }
    }
  } catch {
    // Silent — notification failures never block dashboard
  }

  // ── 2. Area BLOCKED — notify GC + Sub PM ──────────
  try {
    const antiSpamCutoff = new Date(now.getTime() - ANTI_SPAM_WINDOW_MS).toISOString();

    // Find areas that became blocked (active delay, started in last 24h)
    const { data: newBlocks } = await supabase
      .from('delay_logs')
      .select(`
        id, area_id, trade_name, reason_code,
        areas!inner ( name, project_id )
      `)
      .eq('areas.project_id', projectId)
      .is('ended_at', null)
      .gte('started_at', antiSpamCutoff);

    if (newBlocks && newBlocks.length > 0) {
      const { data: recentBlockNotifs } = await supabase
        .from('notifications')
        .select('data')
        .eq('type', 'area_blocked')
        .gte('created_at', antiSpamCutoff);

      const notifiedIds = new Set(
        (recentBlockNotifs ?? []).map((n) => (n.data as Record<string, unknown>)?.delayLogId),
      );

      const toNotify = newBlocks.filter((d) => !notifiedIds.has(d.id));

      if (toNotify.length > 0) {
        // Notify all GC users on the project
        const { data: gcUsers } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .in('role', ['gc_admin', 'gc_pm', 'gc_super']);

        const userIds = [...new Set((gcUsers ?? []).map((u) => u.user_id))];

        const records = toNotify.flatMap((delay) => {
          const area = delay.areas as unknown as Record<string, unknown>;
          return userIds.map((uid) => ({
            user_id: uid,
            type: 'area_blocked',
            title: `Area Blocked — ${(area.name as string)} · ${delay.trade_name}`,
            body: `Reason: ${delay.reason_code}`,
            data: { delayLogId: delay.id, areaId: delay.area_id, tradeName: delay.trade_name },
          }));
        });

        if (records.length > 0) await supabase.from('notifications').insert(records);
      }
    }
  } catch {
    // Silent
  }

  // ── 3. Area READY — notify assigned foremen ───────
  try {
    const antiSpamCutoff = new Date(now.getTime() - ANTI_SPAM_WINDOW_MS).toISOString();

    // Find areas where all prior trades just completed (effective_pct went to 100 recently)
    const { data: recentlyReady } = await supabase
      .from('area_trade_status')
      .select(`
        id, area_id, trade_type, effective_pct,
        areas!inner ( name, project_id )
      `)
      .eq('areas.project_id', projectId)
      .gte('effective_pct', 100)
      .gte('updated_at', antiSpamCutoff);

    if (recentlyReady && recentlyReady.length > 0) {
      const { data: recentReadyNotifs } = await supabase
        .from('notifications')
        .select('data')
        .eq('type', 'area_ready')
        .gte('created_at', antiSpamCutoff);

      const notifiedKeys = new Set(
        (recentReadyNotifs ?? []).map((n) => {
          const d = n.data as Record<string, unknown>;
          return `${d?.areaId}:${d?.tradeName}`;
        }),
      );

      const toNotify = recentlyReady.filter(
        (r) => !notifiedKeys.has(`${r.area_id}:${r.trade_type}`),
      );

      if (toNotify.length > 0) {
        // Get foremen assigned to these areas
        const areaIds = [...new Set(toNotify.map((r) => r.area_id))];
        const { data: assignments } = await supabase
          .from('user_assignments')
          .select('user_id, area_id')
          .in('area_id', areaIds);

        const records = toNotify.flatMap((item) => {
          const area = item.areas as unknown as Record<string, unknown>;
          const foremen = (assignments ?? []).filter((a) => a.area_id === item.area_id);
          return foremen.map((f) => ({
            user_id: f.user_id,
            type: 'area_ready',
            title: `Area Ready — ${(area.name as string)} · ${item.trade_type}`,
            body: 'This trade is complete. Next trade can begin.',
            data: { areaId: item.area_id, tradeName: item.trade_type },
          }));
        });

        if (records.length > 0) await supabase.from('notifications').insert(records);
      }
    }
  } catch {
    // Silent
  }

  // ── 4. NOD Draft Ready — notify superintendent ────
  try {
    const antiSpamCutoff = new Date(now.getTime() - ANTI_SPAM_WINDOW_MS).toISOString();

    const { data: newDrafts } = await supabase
      .from('nod_drafts')
      .select(`
        id, delay_log_id, created_at,
        delay_logs!inner ( area_id, trade_name, areas!inner ( name, project_id ) )
      `)
      .is('sent_at', null)
      .gte('created_at', antiSpamCutoff);

    // Filter to this project
    const projectDrafts = (newDrafts ?? []).filter((d) => {
      const dl = d.delay_logs as unknown as Record<string, unknown>;
      const area = dl.areas as unknown as Record<string, unknown>;
      return area.project_id === projectId;
    });

    if (projectDrafts.length > 0) {
      const { data: recentDraftNotifs } = await supabase
        .from('notifications')
        .select('data')
        .eq('type', 'nod_draft_ready')
        .gte('created_at', antiSpamCutoff);

      const notifiedIds = new Set(
        (recentDraftNotifs ?? []).map((n) => (n.data as Record<string, unknown>)?.draftId),
      );

      const toNotify = projectDrafts.filter((d) => !notifiedIds.has(d.id));

      if (toNotify.length > 0) {
        // Notify GC supers and PMs
        const { data: gcUsers } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .in('role', ['gc_admin', 'gc_pm', 'gc_super']);

        const userIds = [...new Set((gcUsers ?? []).map((u) => u.user_id))];

        const records = toNotify.flatMap((draft) => {
          const dl = draft.delay_logs as unknown as Record<string, unknown>;
          const area = dl.areas as unknown as Record<string, unknown>;
          return userIds.map((uid) => ({
            user_id: uid,
            type: 'nod_draft_ready',
            title: `NOD Draft Ready — ${(area.name as string)} · ${dl.trade_name as string}`,
            body: 'Review and sign the Notice of Delay.',
            data: { draftId: draft.id, delayLogId: draft.delay_log_id },
          }));
        });

        if (records.length > 0) await supabase.from('notifications').insert(records);
      }
    }
  } catch {
    // Silent
  }

  // ── 5. 48h/72h Escalation ──────────────────────────
  try {
    await checkEscalations(projectId);
  } catch {
    // Silent
  }

  // ── 3. GC Verification Reminders (4h + 24h) ──────
  try {
    const reminderCutoff4h = new Date(
      now.getTime() - VERIFICATION_REMINDER_HOURS * 3_600_000,
    ).toISOString();
    const escalationCutoff24h = new Date(
      now.getTime() - VERIFICATION_ESCALATION_HOURS * 3_600_000,
    ).toISOString();
    const antiSpamCutoff = new Date(now.getTime() - ANTI_SPAM_WINDOW_MS).toISOString();

    // Fetch all area/trade pairs with pending GC verification for this project
    const { data: pendingVerifications } = await supabase
      .from('area_trade_status')
      .select(`
        id, area_id, trade_type, gc_verification_pending_since, last_notification_sent_at,
        areas!inner ( name, project_id )
      `)
      .eq('areas.project_id', projectId)
      .eq('gc_verification_pending', true)
      .not('gc_verification_pending_since', 'is', null);

    if (pendingVerifications && pendingVerifications.length > 0) {
      const notifications: Array<{
        user_id: string;
        type: string;
        title: string;
        body: string;
        data: Record<string, unknown>;
      }> = [];
      const atsIdsToStamp: string[] = [];

      for (const pv of pendingVerifications) {
        const pendingSince = pv.gc_verification_pending_since as string;
        const lastNotified = pv.last_notification_sent_at as string | null;
        const area = pv.areas as unknown as Record<string, unknown>;
        const areaName = (area.name as string) ?? 'Unknown';

        // Anti-spam: skip if already notified within window
        if (lastNotified && lastNotified > antiSpamCutoff) continue;

        // Look up assigned foremen for this area/trade
        const { data: assignments } = await supabase
          .from('user_assignments')
          .select('user_id')
          .eq('area_id', pv.area_id)
          .eq('trade_name', pv.trade_type);

        const foremanIds = [...new Set((assignments ?? []).map((a) => a.user_id))];
        if (foremanIds.length === 0) continue;

        // 24h escalation (higher priority — check first)
        if (pendingSince < escalationCutoff24h) {
          for (const fid of foremanIds) {
            notifications.push({
              user_id: fid,
              type: 'gc_verification_escalation',
              title: `Verificación pendiente 24h+ — ${areaName}`,
              body: `${pv.trade_type}: GC no ha verificado en más de 24 horas. Documenta la demora.`,
              data: {
                area_id: pv.area_id,
                trade_type: pv.trade_type,
                pending_since: pendingSince,
                escalation_level: '24h',
              },
            });
          }
          atsIdsToStamp.push(pv.id);
        }
        // 4h reminder
        else if (pendingSince < reminderCutoff4h) {
          for (const fid of foremanIds) {
            notifications.push({
              user_id: fid,
              type: 'gc_verification_reminder',
              title: `Recordatorio: verificación pendiente — ${areaName}`,
              body: `${pv.trade_type}: verificación solicitada hace 4h+. GC ha sido notificado.`,
              data: {
                area_id: pv.area_id,
                trade_type: pv.trade_type,
                pending_since: pendingSince,
                escalation_level: '4h',
              },
            });
          }
          atsIdsToStamp.push(pv.id);
        }
      }

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      // Stamp anti-spam timestamps
      if (atsIdsToStamp.length > 0) {
        await supabase
          .from('area_trade_status')
          .update({ last_notification_sent_at: now.toISOString() })
          .in('id', atsIdsToStamp);
      }
    }
  } catch {
    // Silent — verification reminders never block dashboard
  }
}
