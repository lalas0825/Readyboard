'use server';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server-side push notification sender.
 *
 * Looks up push tokens from users table and sends via Expo Push API.
 * Fire-and-forget — never blocks the calling operation.
 *
 * Anti-spam: caller is responsible for checking notification frequency.
 */
export async function sendPushNotification(params: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { userIds, title, body, data } = params;
  if (!userIds.length) return;

  try {
    const supabase = createServiceClient();

    // Fetch push tokens
    const { data: users } = await supabase
      .from('users')
      .select('id, push_token')
      .in('id', userIds)
      .not('push_token', 'is', null);

    if (!users?.length) return;

    // Build Expo messages
    const messages = users
      .filter((u) => u.push_token?.startsWith('ExponentPushToken'))
      .map((u) => ({
        to: u.push_token!,
        sound: 'default' as const,
        title,
        body,
        data: { ...data, userId: u.id },
        priority: 'high' as const,
        channelId: 'default',
      }));

    if (messages.length === 0) return;

    // Send to Expo Push API
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    // Fire-and-forget: log but never throw
    console.error('[pushNotify] Failed:', err);
  }
}

/**
 * Convenience: send push to all GC PMs + admins for a project.
 */
export async function notifyProjectGC(
  projectId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient();

  // Get project's GC org
  const { data: project } = await supabase
    .from('projects')
    .select('gc_org_id')
    .eq('id', projectId)
    .single();

  if (!project?.gc_org_id) return;

  // Get GC users with push tokens
  const { data: gcUsers } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', project.gc_org_id)
    .in('role', ['gc_pm', 'gc_admin', 'gc_super'])
    .not('push_token', 'is', null);

  if (!gcUsers?.length) return;

  await sendPushNotification({
    userIds: gcUsers.map((u) => u.id),
    title,
    body,
    data: { ...data, projectId },
  });
}

/**
 * Convenience: send push to a specific user.
 */
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await sendPushNotification({
    userIds: [userId],
    title,
    body,
    data,
  });
}
