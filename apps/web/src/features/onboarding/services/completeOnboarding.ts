'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';

type TradeInput = { trade_name: string; sequence_order: number };
type AreaInput = { name: string; floor: string; area_type: string; unit_name?: string; area_code?: string; description?: string };
type InviteInput = { email?: string; phone?: string; role: string };

export async function completeOnboarding(input: {
  orgName: string;
  orgLanguage: string;
  projectName?: string;
  projectAddress?: string;
  laborRate?: number;
  jurisdiction?: string;
  trades?: TradeInput[];
  areas?: AreaInput[];
  invites?: InviteInput[];
}): Promise<
  | { ok: true; projectId: string; areasCreated: number; tasksCloned: number }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('complete_onboarding', {
    p_user_id: session.user.id,
    p_org_name: input.orgName,
    p_org_language: input.orgLanguage || 'en',
    p_project_name: input.projectName || null,
    p_project_address: input.projectAddress || null,
    p_labor_rate: input.laborRate || 85,
    p_jurisdiction: input.jurisdiction || 'NY',
    p_trades: input.trades ?? null,
    p_areas: input.areas ?? null,
    p_invites: input.invites ?? null,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { ok: boolean; project_id: string; areas_created: number; tasks_cloned: number };

  return {
    ok: true,
    projectId: result.project_id,
    areasCreated: result.areas_created,
    tasksCloned: result.tasks_cloned,
  };
}
