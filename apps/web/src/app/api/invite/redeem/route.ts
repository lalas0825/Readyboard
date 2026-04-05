import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redeemInviteToken } from '@/features/invites/services/redeemInviteToken';

/**
 * POST /api/invite/redeem
 * Called from JoinProjectForm after user signs up.
 * Redeems the invite token and assigns user to project.
 *
 * SECURITY: userId comes from the client (just signed up), but redeemInviteToken
 * uses the service role and validates the token is valid/unused/unexpired.
 * The session may not exist yet (email confirmation pending) so we cannot
 * rely on supabase.auth.getUser() here.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, userId, email } = body;

    if (!token || !userId) {
      return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 });
    }

    // Try session-based auth first (for "sign in" flow)
    // Fall back to userId from body (for "sign up" flow where email not yet confirmed)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const resolvedUserId: string = user?.id ?? userId;

    const result = await redeemInviteToken({ token, userId: resolvedUserId, email });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, projectId: result.projectId, role: result.role });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
