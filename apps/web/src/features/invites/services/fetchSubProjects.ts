'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';

export type SubProject = {
  projectId: string;
  projectName: string;
  role: string;
  joinedAt: string;
};

/**
 * Fetches projects the current sub_pm has been invited to.
 * Uses project_members table.
 */
export async function fetchSubProjects(): Promise<SubProject[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('project_members')
    .select(`
      project_id,
      role,
      created_at,
      projects!inner ( name )
    `)
    .eq('user_id', session.user.id);

  if (error || !data) return [];

  return data.map((row) => {
    const project = row.projects as unknown as Record<string, unknown>;
    return {
      projectId: row.project_id,
      projectName: (project.name as string) ?? 'Unknown Project',
      role: row.role,
      joinedAt: row.created_at,
    };
  });
}
