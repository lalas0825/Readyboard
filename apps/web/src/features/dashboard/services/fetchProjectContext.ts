'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type ProjectContext = {
  currentProjectId: string;
  projects: { id: string; name: string }[];
};

/**
 * Fetches the project list and resolves the current projectId.
 * Used by the dashboard layout to pass context to Sidebar + child pages.
 */
export async function fetchProjectContext(
  requestedProjectId?: string,
): Promise<ProjectContext> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Fetch all projects the user has access to (RLS handles scoping)
  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, name')
    .order('name');

  const projects = (projectRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Resolve current project: requested > first available
  let currentProjectId = '';
  if (requestedProjectId && projects.some((p) => p.id === requestedProjectId)) {
    currentProjectId = requestedProjectId;
  } else if (projects.length > 0) {
    currentProjectId = projects[0].id;
  }

  return { currentProjectId, projects };
}
