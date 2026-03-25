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
    .select('id, project_id, role, area_id, used_at, expires_at')
    .eq('token', input.token)
    .single();

  if (fetchErr || !invite) return { ok: false, error: 'Invalid invite token.' };
  if (invite.used_at) return { ok: false, error: 'Token already used.' };
  if (new Date(invite.expires_at) < new Date()) return { ok: false, error: 'Token expired.' };

  // 2. Handle based on role
  if (invite.role === 'sub_pm') {
    // Add to project_members
    const { error: memberErr } = await supabase
      .from('project_members')
      .upsert({
        project_id: invite.project_id,
        user_id: input.userId,
        org_id: input.orgId ?? null,
        role: 'sub_pm',
      }, { onConflict: 'project_id,user_id' });

    if (memberErr) return { ok: false, error: memberErr.message };
  } else if (invite.role === 'foreman' && invite.area_id) {
    // Get all trade sequences for this area's project + area_type
    const { data: area } = await supabase
      .from('areas')
      .select('area_type, project_id')
      .eq('id', invite.area_id)
      .single();

    if (area) {
      const { data: trades } = await supabase
        .from('trade_sequences')
        .select('trade_name')
        .eq('project_id', area.project_id)
        .eq('area_type', area.area_type);

      // Assign foreman to area for all trades
      if (trades && trades.length > 0) {
        const assignments = trades.map((t) => ({
          user_id: input.userId,
          area_id: invite.area_id!,
          trade_name: t.trade_name,
        }));

        await supabase
          .from('user_assignments')
          .upsert(assignments, { onConflict: 'user_id,area_id,trade_name', ignoreDuplicates: true });
      }
    }
  }

  // 3. Mark token as used
  await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString(), used_by: input.userId })
    .eq('id', invite.id);

  // 4. Audit (fire-and-forget)
  await supabase.from('audit_log').insert({
    table_name: 'invite_tokens',
    action: 'invite_redeemed',
    changed_by: input.userId,
    record_id: invite.project_id,
    new_value: { role: invite.role, areaId: invite.area_id },
  });

  return { ok: true, projectId: invite.project_id, role: invite.role };
}
