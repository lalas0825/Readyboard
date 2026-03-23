'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { checkEscalations } from '@/features/legal/services/escalationCheck';

const NOD_REMINDER_HOURS = 20;
const ANTI_SPAM_WINDOW_MS = 24 * 3_600_000;

/**
 * Non-blocking notification trigger — runs as fire-and-forget side-effect.
 *
 * 1. Checks delay_logs > 20h old with no nod_draft → inserts 'nod_reminder'
 * 2. Delegates 48h/72h escalation to checkEscalations() from Week 6
 * 3. Anti-spam: skips if notification for same entity exists within 24h
 */
export async function notificationTrigger(projectId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const supabase = createServiceClient();
  const now = new Date();

  // ── 1. NOD Reminder (20h) ──────────────────────────
  try {
    const reminderCutoff = new Date(now.getTime() - NOD_REMINDER_HOURS * 3_600_000).toISOString();

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
      for (const delay of staleDelays) {
        // Anti-spam: check if we already notified about this delay in 24h
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .eq('type', 'nod_reminder')
          .contains('data', { delayLogId: delay.id })
          .gte('created_at', new Date(now.getTime() - ANTI_SPAM_WINDOW_MS).toISOString());

        if ((count ?? 0) === 0) {
          const area = delay.areas as unknown as Record<string, unknown>;
          await supabase.from('notifications').insert({
            user_id: session.user.id,
            type: 'nod_reminder',
            title: `NOD pending — ${(area.name as string) ?? 'Unknown'} · ${delay.trade_name}`,
            body: 'Delay has been active 20h+ without a Notice of Delay draft.',
            data: {
              delayLogId: delay.id,
              areaId: delay.area_id,
              tradeName: delay.trade_name,
            },
          });
        }
      }
    }
  } catch {
    // Silent — notification failures never block dashboard
  }

  // ── 2. 48h/72h Escalation ──────────────────────────
  try {
    await checkEscalations(projectId);
  } catch {
    // Silent
  }
}
