'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type DashboardNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
};

/**
 * Fetches unread + recent notifications for the current user.
 * Returns last 20 notifications, ordered by created_at DESC.
 */
export async function fetchNotifications(): Promise<DashboardNotification[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, created_at, read_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    data: (n.data as Record<string, unknown>) ?? null,
    createdAt: n.created_at,
    readAt: n.read_at ?? null,
  }));
}

/**
 * Returns count of unread notifications for badge display.
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .is('read_at', null);

  return count ?? 0;
}
