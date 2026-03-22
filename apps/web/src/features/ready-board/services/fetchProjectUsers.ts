'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { AssignableUser } from '../types';

/**
 * Server action: fetches sub-side users for a project.
 * Uses user-scoped client when authenticated, service_role for dev bypass.
 */
export async function fetchProjectUsers(
  projectId: string,
): Promise<{ ok: true; data: AssignableUser[] } | { ok: false; error: string }> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('sub_org_id')
    .eq('id', projectId)
    .single();

  if (projError || !project?.sub_org_id) {
    return { ok: false, error: projError?.message ?? 'Project not found or no sub org assigned' };
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('org_id', project.sub_org_id)
    .in('role', ['foreman', 'sub_pm', 'superintendent'])
    .order('name');

  if (usersError) {
    return { ok: false, error: usersError.message };
  }

  return {
    ok: true,
    data: (users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
    })),
  };
}
