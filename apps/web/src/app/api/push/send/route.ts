import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/push/send
 *
 * Server-side push notification sender via Expo Push API.
 * Called by notification triggers (server actions, not client).
 *
 * Body: { userIds: string[], title: string, body: string, data?: object }
 *
 * Flow:
 * 1. Lookup push_tokens for given userIds
 * 2. Build Expo push messages
 * 3. Send to Expo Push API
 * 4. Return delivery status
 */
export async function POST(request: NextRequest) {
  try {
    const { userIds, title, body, data } = await request.json();

    if (!userIds?.length || !title || !body) {
      return NextResponse.json({ error: 'Missing userIds, title, or body' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch push tokens for target users
    const { data: users } = await supabase
      .from('users')
      .select('id, push_token, language')
      .in('id', userIds)
      .not('push_token', 'is', null);

    if (!users?.length) {
      return NextResponse.json({ sent: 0, reason: 'No push tokens found' });
    }

    // Build Expo push messages
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

    if (messages.length === 0) {
      return NextResponse.json({ sent: 0, reason: 'No valid Expo tokens' });
    }

    // Send to Expo Push API (batch, max 100 per request)
    const chunks = chunkArray(messages, 100);
    let totalSent = 0;

    for (const chunk of chunks) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (response.ok) {
        totalSent += chunk.length;
      } else {
        console.error('[Push API] Expo responded with:', response.status);
      }
    }

    return NextResponse.json({ sent: totalSent });
  } catch (err) {
    console.error('[Push API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
