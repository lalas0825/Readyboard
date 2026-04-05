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
  email?: string;
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

  // 2. Resolve the real userId — Supabase returns a fake ID on duplicate signUp (anti-enumeration)
  //    If public.users doesn't have this ID, look up by email to find the real user.
  let resolvedUserId = input.userId;

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', resolvedUserId)
    .single();

  if (!existingUser) {
    // Try to find real user by email first
    if (input.email) {
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const realUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === input.email!.toLowerCase()
      );
      if (realUser) {
        resolvedUserId = realUser.id;
      }
    }

    // Check again with resolved ID
    const { data: userAfterResolve } = await supabase
      .from('users')
      .select('id')
      .eq('id', resolvedUserId)
      .single();

    if (!userAfterResolve) {
      // Last resort: create the public.users row from auth data
      const { data: authUser } = await supabase.auth.admin.getUserById(resolvedUserId);
      if (!authUser?.user) {
        return { ok: false, error: 'Account not found. Please check your email for a confirmation link, then try again.' };
      }

      const meta = (authUser.user.user_metadata ?? {}) as Record<string, string>;
      const userRole = meta.role ?? invite.role;
      const orgType = ['gc_admin', 'gc_pm', 'gc_super', 'owner'].includes(userRole) ? 'gc' : 'sub';

      const { data: org } = await supabase
        .from('organizations')
        .insert({
          name: meta.org_name ?? `${meta.name ?? 'User'}'s Organization`,
          type: orgType,
          default_language: 'en',
        })
        .select('id')
        .single();

      await supabase.from('users').upsert({
        id: resolvedUserId,
        email: authUser.user.email,
        name: meta.name ?? 'User',
        role: userRole,
        org_id: org?.id ?? null,
        language: 'en',
        onboarding_complete: false,
      });
    }
  }

  // 3. Add to project_members
  if (['gc_pm', 'gc_super', 'sub_pm', 'superintendent', 'foreman'].includes(invite.role)) {
    const { error: memberErr } = await supabase
      .from('project_members')
      .upsert({
        project_id: invite.project_id,
        user_id: resolvedUserId,
        org_id: input.orgId ?? null,
        role: invite.role,
        trade_name: invite.trade_name ?? null,
      }, { onConflict: 'project_id,user_id' });

    if (memberErr) return { ok: false, error: memberErr.message };
  }

  // 4. Assign project areas — filtered by invited trade if specified
  if (['sub_pm', 'superintendent', 'foreman'].includes(invite.role)) {
    if (invite.trade_name) {
      // Assign only areas for the invited trade (prevents PowerSync overload)
      const { data: projectAreas } = await supabase
        .from('areas')
        .select('id')
        .eq('project_id', invite.project_id);

      if (projectAreas?.length) {
        const rows = projectAreas.map((a) => ({
          user_id: resolvedUserId,
          area_id: a.id,
          trade_name: invite.trade_name!,
        }));
        await supabase.from('user_assignments').upsert(rows, { onConflict: 'user_id,area_id,trade_name' });
      }
    } else {
      // No specific trade — assign all areas × all trades
      await supabase.rpc('assign_user_to_project', {
        p_user_id: resolvedUserId,
        p_project_id: invite.project_id,
      });
    }

    // 4b. Link sub org to project if not yet linked (needed for RLS visibility)
    const { data: userRow } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', resolvedUserId)
      .single();

    if (userRow?.org_id) {
      await supabase
        .from('projects')
        .update({ sub_org_id: userRow.org_id })
        .eq('id', invite.project_id)
        .is('sub_org_id', null);
    }
  }

  // 5. Mark user as onboarded (they joined via invite — no onboarding wizard needed)
  await supabase
    .from('users')
    .update({ onboarding_complete: true })
    .eq('id', resolvedUserId);

  // 6. Mark token as used
  await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString(), used_by: resolvedUserId })
    .eq('id', invite.id);

  // 6. Audit (fire-and-forget)
  await supabase.from('audit_log').insert({
    table_name: 'invite_tokens',
    action: 'invite_redeemed',
    changed_by: resolvedUserId,
    record_id: invite.project_id,
    new_value: { role: invite.role, areaId: invite.area_id },
  });

  return { ok: true, projectId: invite.project_id, role: invite.role };
}
