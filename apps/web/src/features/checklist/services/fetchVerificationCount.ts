'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Returns the count of area/trade pairs awaiting GC verification.
 * Used for the badge on the Verifications tab.
 */
export async function fetchVerificationCount(): Promise<number> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { count, error } = await supabase
    .from('area_trade_status')
    .select('id', { count: 'exact', head: true })
    .eq('gc_verification_pending', true);

  if (error) return 0;
  return count ?? 0;
}
