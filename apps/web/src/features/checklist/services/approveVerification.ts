'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Calls gc_approve_verification RPC atomically:
 *   1. Marks all pending GC tasks as complete
 *   2. Clears gc_verification_pending
 *   3. Writes audit entry
 * All inside a single DB transaction.
 */
export async function approveVerification(
  areaId: string,
  tradeType: string,
): Promise<{ ok: true; approvedCount: number } | { ok: false; error: string }> {
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

  const { data, error } = await supabase.rpc('gc_approve_verification', {
    p_area_id: areaId,
    p_trade_type: tradeType,
    p_user_id: userId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as Record<string, unknown>;

  // Fire-and-forget: notify assigned foreman (not the GC who approved)
  const service = createServiceClient();
  void (async () => {
    try {
      const { data: assignments } = await service
        .from('user_assignments')
        .select('user_id')
        .eq('area_id', areaId)
        .eq('trade_name', tradeType);

      const foremanIds = [...new Set((assignments ?? []).map((a) => a.user_id))];
      if (foremanIds.length > 0) {
        await service.from('notifications').insert(
          foremanIds.map((fid) => ({
            user_id: fid,
            type: 'gc_verification_approved',
            title: 'Verificación aprobada',
            body: `${tradeType} ha sido verificado y liberado.`,
            data: { area_id: areaId, trade_type: tradeType },
          })),
        );
      }
    } catch {
      // Silent — notification failures never block approval
    }
  })();

  return {
    ok: true,
    approvedCount: (result.approved_count as number) ?? 0,
  };
}
