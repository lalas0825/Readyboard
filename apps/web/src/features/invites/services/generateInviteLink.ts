'use server';

import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTeamInviteEmail } from '@/lib/email/sendEmail';

export type InviteRole = 'gc_pm' | 'gc_super' | 'sub_pm' | 'superintendent' | 'foreman';

const ROLE_LABELS: Record<InviteRole, string> = {
  gc_pm: 'Project Manager',
  gc_super: 'Superintendent',
  sub_pm: 'Sub PM',
  superintendent: 'Superintendent',
  foreman: 'Foreman',
};

/**
 * Generates a unique invite link for a project.
 * Sends email automatically for email invites.
 * For foreman (phone), returns URL for manual sharing via WhatsApp.
 */
export async function generateInviteLink(input: {
  projectId: string;
  role: InviteRole;
  areaId?: string;
  email?: string;
  phone?: string;
  name?: string;
}): Promise<{ ok: true; token: string; url: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('invite_tokens').insert({
    token,
    project_id: input.projectId,
    role: input.role,
    area_id: input.areaId ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    name: input.name ?? null,
    created_by: session.user.id,
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/join/${token}`;

  // Send email invite (fire-and-forget) for non-foreman roles
  if (input.email && input.role !== 'foreman') {
    // Fetch project name + inviter name for the email
    const { data: project } = await supabase
      .from('projects').select('name').eq('id', input.projectId).single();
    const { data: inviter } = await supabase
      .from('users').select('name').eq('id', session.user.id).single();

    sendTeamInviteEmail({
      to: input.email,
      inviterName: inviter?.name ?? 'Your team',
      projectName: project?.name ?? 'Project',
      role: ROLE_LABELS[input.role] ?? input.role,
      joinUrl: url,
      language: 'en',
    });
  }

  // Audit log (fire-and-forget)
  supabase.from('audit_log').insert({
    table_name: 'invite_tokens',
    action: 'invite_created',
    changed_by: session.user.id,
    record_id: input.projectId,
    new_value: { role: input.role, email: input.email, phone: input.phone },
  });

  return { ok: true, token, url };
}
