'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTeamInviteEmail } from '@/lib/email/sendEmail';

const ROLE_LABELS: Record<string, string> = {
  gc_pm: 'Project Manager',
  gc_super: 'Superintendent',
  sub_pm: 'Sub PM',
  superintendent: 'Superintendent',
  foreman: 'Foreman',
};

/** Revoke a pending invite — deletes the token */
export async function revokeInvite(
  tokenId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('invite_tokens')
    .delete()
    .eq('id', tokenId)
    .is('used_at', null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Resend an invite — extend expiration + re-send email */
export async function resendInvite(
  tokenId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();

  // Fetch the invite
  const { data: invite } = await supabase
    .from('invite_tokens')
    .select('id, token, project_id, role, email, phone, name')
    .eq('id', tokenId)
    .is('used_at', null)
    .single();

  if (!invite) return { ok: false, error: 'Invite not found or already used' };

  // Extend expiration by 7 days from now
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('invite_tokens')
    .update({ expires_at: newExpiry })
    .eq('id', tokenId);

  // Re-send email if it's an email invite
  if (invite.email && invite.role !== 'foreman') {
    const { data: project } = await supabase
      .from('projects').select('name').eq('id', invite.project_id).single();
    const { data: inviter } = await supabase
      .from('users').select('name').eq('id', session.user.id).single();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const url = `${baseUrl}/join/${invite.token}`;

    sendTeamInviteEmail({
      to: invite.email,
      inviterName: inviter?.name ?? 'Your team',
      projectName: project?.name ?? 'Project',
      role: ROLE_LABELS[invite.role] ?? invite.role,
      joinUrl: url,
      language: 'en',
    });
  }

  return { ok: true };
}
