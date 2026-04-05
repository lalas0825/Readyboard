'use server';

import { createServiceClient } from '@/lib/supabase/service';

export type InviteTokenData = {
  id: string;
  token: string;
  projectId: string;
  projectName: string;
  role: 'gc_pm' | 'gc_super' | 'sub_pm' | 'superintendent' | 'foreman';
  tradeName: string | null;
  areaId: string | null;
  areaName: string | null;
  expiresAt: string;
  isExpired: boolean;
  isUsed: boolean;
};

/**
 * Validates an invite token and returns project info.
 * No auth required — called from public /join/[token] page.
 */
export async function validateInviteToken(
  token: string,
): Promise<{ ok: true; data: InviteTokenData } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('invite_tokens')
    .select(`
      id,
      token,
      project_id,
      role,
      area_id,
      trade_name,
      expires_at,
      used_at,
      projects!inner ( name )
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    return { ok: false, error: 'Invalid or expired invite link.' };
  }

  const project = data.projects as unknown as Record<string, unknown>;
  const isExpired = new Date(data.expires_at) < new Date();
  const isUsed = !!data.used_at;

  if (isExpired) return { ok: false, error: 'This invite link has expired.' };
  if (isUsed) return { ok: false, error: 'This invite link has already been used.' };

  // Resolve area name if foreman invite
  let areaName: string | null = null;
  if (data.area_id) {
    const { data: area } = await supabase
      .from('areas')
      .select('name')
      .eq('id', data.area_id)
      .single();
    areaName = area?.name ?? null;
  }

  return {
    ok: true,
    data: {
      id: data.id,
      token: data.token,
      projectId: data.project_id,
      projectName: (project.name as string) ?? 'Unknown Project',
      role: data.role as InviteTokenData['role'],
      tradeName: data.trade_name ?? null,
      areaId: data.area_id,
      areaName,
      expiresAt: data.expires_at,
      isExpired,
      isUsed,
    },
  };
}
