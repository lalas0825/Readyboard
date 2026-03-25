'use server';

import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Generates a unique invite link for a project.
 * GC PM creates these to invite sub PMs or foremen.
 */
export async function generateInviteLink(input: {
  projectId: string;
  role: 'sub_pm' | 'foreman';
  areaId?: string;
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
    created_by: session.user.id,
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };

  // Write audit entry (fire-and-forget)
  await supabase.from('audit_log').insert({
    table_name: 'invite_tokens',
    action: 'invite_created',
    changed_by: session.user.id,
    record_id: input.projectId,
    new_value: { role: input.role, areaId: input.areaId },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/join/${token}`;

  return { ok: true, token, url };
}
