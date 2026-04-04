'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Types ──────────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  orgName: string | null;
  createdAt: string;
};

export type PendingInvite = {
  id: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  url: string;
};

export type TeamPageData = {
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  projectId: string;
  projectName: string;
  trades: { trade_name: string; sequence_order: number }[];
};

// ─── Fetch ──────────────────────────────────────────

export async function fetchTeamMembers(
  projectId?: string,
): Promise<TeamPageData> {
  const session = await getSession();
  if (!session) return emptyData();

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Resolve projectId
  let pid = projectId;
  if (!pid) {
    const { data: p } = await supabase.from('projects').select('id, name').limit(1).single();
    pid = p?.id;
    if (!pid) return emptyData();
  }

  // Parallel fetches
  const [projectResult, gcMembersResult, subMembersResult, invitesResult, tradesResult] = await Promise.all([
    supabase.from('projects').select('name, org_id, sub_org_id').eq('id', pid).single(),
    // GC org members
    supabase.from('projects').select('org_id').eq('id', pid).single().then(async ({ data }) => {
      if (!data?.org_id) return { data: [] };
      return supabase
        .from('users')
        .select('id, name, email, phone, role, created_at, organizations!inner(name)')
        .eq('org_id', data.org_id)
        .order('name');
    }),
    // Sub org members (via project_members or direct sub_org_id)
    supabase.from('projects').select('sub_org_id').eq('id', pid).single().then(async ({ data }) => {
      if (!data?.sub_org_id) return { data: [] };
      return supabase
        .from('users')
        .select('id, name, email, phone, role, created_at, organizations!inner(name)')
        .eq('org_id', data.sub_org_id)
        .order('name');
    }),
    // Pending invites
    supabase
      .from('invite_tokens')
      .select('id, role, created_at, expires_at, token')
      .eq('project_id', pid)
      .is('used_at', null)
      .order('created_at', { ascending: false }),
    // Trades for invite modal
    supabase
      .from('trade_sequences')
      .select('trade_name, sequence_order')
      .eq('project_id', pid)
      .order('sequence_order'),
  ]);

  // Merge GC + Sub members
  const allUsers = [...(gcMembersResult.data ?? []), ...(subMembersResult.data ?? [])];
  const seen = new Set<string>();
  const members: TeamMember[] = [];

  for (const u of allUsers) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const org = u.organizations as unknown as Record<string, unknown>;
    members.push({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      orgName: (org?.name as string) ?? null,
      createdAt: u.created_at,
    });
  }

  // Pending invites
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const now = Date.now();
  const pendingInvites: PendingInvite[] = (invitesResult.data ?? []).map((inv) => ({
    id: inv.id,
    role: inv.role,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
    isExpired: new Date(inv.expires_at).getTime() < now,
    url: `${baseUrl}/join/${inv.token}`,
  }));

  return {
    members,
    pendingInvites,
    projectId: pid,
    projectName: projectResult.data?.name ?? '',
    trades: [...new Map((tradesResult.data ?? []).map((t) => [t.trade_name, t])).values()],
  };
}

function emptyData(): TeamPageData {
  return { members: [], pendingInvites: [], projectId: '', projectName: '', trades: [] };
}
