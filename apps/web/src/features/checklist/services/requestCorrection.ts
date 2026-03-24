'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Calls gc_request_correction RPC atomically:
 *   1. Sets selected tasks to correction_requested
 *   2. Fills correction fields (reason, note, timestamp, user)
 *   3. Clears gc_verification_pending
 *   4. Writes audit entry
 * All inside a single DB transaction.
 */
export async function requestCorrection(input: {
  taskIds: string[];
  areaId: string;
  tradeType: string;
  reason: string;
  note: string | null;
}): Promise<{ ok: true; correctedCount: number } | { ok: false; error: string }> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  let userId = session?.user.id;
  if (!userId && process.env.NODE_ENV === 'development') {
    const service = createServiceClient();
    const { data: gcUser } = await service
      .from('users')
      .select('id')
      .eq('role', 'gc_pm')
      .limit(1)
      .single();
    userId = gcUser?.id;
  }

  if (!userId) {
    return { ok: false, error: 'No authenticated user found.' };
  }

  const { data, error } = await supabase.rpc('gc_request_correction', {
    p_task_ids: input.taskIds,
    p_area_id: input.areaId,
    p_trade_type: input.tradeType,
    p_user_id: userId,
    p_reason: input.reason,
    p_note: input.note,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as Record<string, unknown>;

  // Fire-and-forget: notify assigned foreman (not the GC who requested)
  const service = createServiceClient();
  void (async () => {
    try {
      const { data: assignments } = await service
        .from('user_assignments')
        .select('user_id')
        .eq('area_id', input.areaId)
        .eq('trade_name', input.tradeType);

      const foremanIds = [...new Set((assignments ?? []).map((a) => a.user_id))];
      if (foremanIds.length > 0) {
        await service.from('notifications').insert(
          foremanIds.map((fid) => ({
            user_id: fid,
            type: 'gc_correction_requested',
            title: 'Corrección solicitada',
            body: `${input.tradeType}: ${input.reason}`,
            data: {
              area_id: input.areaId,
              trade_type: input.tradeType,
              reason: input.reason,
              task_ids: input.taskIds,
            },
          })),
        );
      }

      // Update anti-spam timestamp
      await service
        .from('area_trade_status')
        .update({ last_notification_sent_at: new Date().toISOString() })
        .eq('area_id', input.areaId)
        .eq('trade_type', input.tradeType);
    } catch {
      // Silent — notification failures never block correction action
    }
  })();

  return {
    ok: true,
    correctedCount: (result.corrected_count as number) ?? 0,
  };
}
