import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redeemInviteToken } from '@/features/invites/services/redeemInviteToken';

/**
 * POST /api/invite/redeem
 * Called from JoinProjectForm after user signs up.
 * Redeems the invite token and assigns user to project.
 *
 * SECURITY: userId is derived from the authenticated session,
 * never trusted from the client payload.
 */
export async function POST(request: Request) {
  try {
    // Derive userId from authenticated session — never trust client
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const result = await redeemInviteToken({ token, userId: user.id });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, projectId: result.projectId, role: result.role });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
