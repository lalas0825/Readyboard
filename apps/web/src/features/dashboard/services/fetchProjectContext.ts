'use server';

import { unstable_cache } from 'next/cache';
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
 *
 * Cached 30s per user — project list rarely changes, avoids a DB round-trip
 * on every navigation.
 */
export async function fetchProjectContext(
  requestedProjectId?: string,
): Promise<ProjectContext> {
  const session = await getSession();
  const isDevBypass = session?.isDevBypass ?? false;
  const userId = session?.user.id ?? 'anon';

  // Cache the project list per user for 30 seconds.
  // This avoids hitting the DB on every page navigation in the dashboard.
  const fetchProjects = unstable_cache(
    async () => {
      const supabase = isDevBypass ? createServiceClient() : await createClient();
      const { data: projectRows } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      return (projectRows ?? []).map((p) => ({ id: p.id, name: p.name }));
    },
    [`project-list-${userId}`],
    { revalidate: 30 },
  );

  const projects = await fetchProjects();

  // Resolve current project: requested > first available
  let currentProjectId = '';
  if (requestedProjectId && projects.some((p) => p.id === requestedProjectId)) {
    currentProjectId = requestedProjectId;
  } else if (projects.length > 0) {
    currentProjectId = projects[0].id;
  }

  return { currentProjectId, projects };
}
