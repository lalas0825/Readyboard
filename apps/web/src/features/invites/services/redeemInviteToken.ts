'use server';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Redeems an invite token after user signup/login.
 * - For sub_pm: creates project_members entry + org if needed
 * - For foreman: creates user_assignments entry
 * Marks token as used.
 */
export async function redeemInviteToken(input: {
  token: string;
  userId: string;
  orgId?: string;
}): Promise<{ ok: true; projectId: string; role: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  // 1. Fetch and validate token
  const { data: invite, error: fetchErr } = await supabase
    .from('invite_tokens')
    .select('id, project_id, role, area_id, trade_name, used_at, expires_at')
    .eq('token', input.token)
    .single();

  if (fetchErr || !invite) return { ok: false, error: 'Invalid invite token.' };
  if (invite.used_at) return { ok: false, error: 'Token already used.' };
  if (new Date(invite.expires_at) < new Date()) return { ok: false, error: 'Token expired.' };

  // 2. Add to project_members
  if (['gc_pm', 'gc_super', 'sub_pm', 'superintendent', 'foreman'].includes(invite.role)) {
    const { error: memberErr } = await supabase
      .from('project_members')
      .upsert({
        project_id: invite.project_id,
        user_id: input.userId,
        org_id: input.orgId ?? null,
        role: invite.role,
        trade_name: invite.trade_name ?? null,
      }, { onConflict: 'project_id,user_id' });

    if (memberErr) return { ok: false, error: memberErr.message };
  }

  // 3. Assign ALL project areas (sub/super/foreman get full project access)
  if (['sub_pm', 'superintendent', 'foreman'].includes(invite.role)) {
    await supabase.rpc('assign_user_to_project', {
      p_user_id: input.userId,
      p_project_id: invite.project_id,
    });
  }

  // 4. Mark token as used
  await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString(), used_by: input.userId })
    .eq('id', invite.id);

  // 5. Audit (fire-and-forget)
  await supabase.from('audit_log').insert({
    table_name: 'invite_tokens',
    action: 'invite_redeemed',
    changed_by: input.userId,
    record_id: invite.project_id,
    new_value: { role: invite.role, areaId: invite.area_id },
  });

  return { ok: true, projectId: invite.project_id, role: invite.role };
}
