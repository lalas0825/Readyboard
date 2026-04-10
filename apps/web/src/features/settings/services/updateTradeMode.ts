'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Atomic trade mode switch via RPC.
 * Validates no active tasks when switching to percentage mode.
 * Propagates mode to all area_trade_status records.
 * Writes audit entry.
 */
export async function updateTradeMode(
  projectId: string,
  tradeType: string,
  newMode: 'percentage' | 'checklist',
): Promise<
  | { ok: true; areasUpdated: number; newMode: string }
  | { ok: false; error: string }
> {
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

  const { data, error } = await supabase.rpc('switch_trade_mode', {
    p_project_id: projectId,
    p_trade_type: tradeType,
    p_new_mode: newMode,
    p_user_id: userId,
  });

  if (error) {
    // Extract readable message from Postgres exception
    const msg = error.message.includes('Cannot switch')
      ? error.message
      : `Mode switch failed: ${error.message}`;
    return { ok: false, error: msg };
  }

  const result = data as Record<string, unknown>;

  return {
    ok: true,
    areasUpdated: (result.areas_updated as number) ?? 0,
    newMode: (result.new_mode as string) ?? newMode,
  };
}
