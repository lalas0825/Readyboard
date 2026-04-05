'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function addAreaNote(
  areaId: string,
  projectId: string,
  content: string,
): Promise<{ error: string | null }> {
  if (!content.trim()) return { error: 'Content is required' };

  const session = await getSession();
  if (!session) return { error: 'Not authenticated' };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const authorName = session.user.name ?? session.user.email ?? 'GC Team';
  const authorRole = session.user.role ?? 'gc_pm';

  const { error } = await supabase.from('area_notes').insert({
    area_id: areaId,
    project_id: projectId,
    author_id: session.user.id,
    author_name: authorName,
    author_role: authorRole,
    content: content.trim(),
    is_system: false,
  });

  if (error) return { error: error.message };
  return { error: null };
}
