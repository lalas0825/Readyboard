'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type ProjectSettings = {
  projectId: string;
  name: string;
  address: string | null;
  laborRate: number;
  jurisdiction: string;
  sha256Enabled: boolean;
  safetyGateEnabled: boolean;
  orgName: string | null;
  createdAt: string;
};

export async function fetchProjectSettings(
  projectId?: string,
): Promise<ProjectSettings | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  let pid = projectId;
  if (!pid) {
    const { data: p } = await supabase.from('projects').select('id').limit(1).single();
    pid = p?.id;
  }
  if (!pid) return null;

  const { data } = await supabase
    .from('projects')
    .select('id, name, address, labor_rate_per_hour, legal_jurisdiction, sha256_enabled, safety_gate_enabled, created_at, organizations!gc_org_id(name)')
    .eq('id', pid)
    .single();

  if (!data) return null;

  const org = data.organizations as unknown as Record<string, unknown>;

  return {
    projectId: data.id,
    name: data.name,
    address: data.address,
    laborRate: Number(data.labor_rate_per_hour),
    jurisdiction: data.legal_jurisdiction,
    sha256Enabled: data.sha256_enabled,
    safetyGateEnabled: data.safety_gate_enabled ?? false,
    orgName: (org?.name as string) ?? null,
    createdAt: data.created_at,
  };
}
