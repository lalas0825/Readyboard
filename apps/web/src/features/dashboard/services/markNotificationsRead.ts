'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const session = await getSession();
  if (!session || ids.length === 0) return;

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', session.user.id);
}
