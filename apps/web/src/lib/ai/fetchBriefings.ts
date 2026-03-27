'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type BriefingEntry = {
  id: string;
  content: string;
  model: string;
  language: string;
  readAt: string | null;
  createdAt: string;
  briefingDate: string;
};

/**
 * Fetches recent briefings for the current user.
 */
export async function fetchRecentBriefings(
  projectId: string,
  limit = 7,
): Promise<BriefingEntry[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data } = await supabase
    .from('briefings')
    .select('id, content, model, language, read_at, created_at, briefing_date')
    .eq('project_id', projectId)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((b) => ({
    id: b.id,
    content: b.content,
    model: b.model,
    language: b.language,
    readAt: b.read_at,
    createdAt: b.created_at,
    briefingDate: b.briefing_date,
  }));
}

/**
 * Marks a briefing as read.
 */
export async function markBriefingRead(briefingId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  await supabase
    .from('briefings')
    .update({ read_at: new Date().toISOString() })
    .eq('id', briefingId)
    .eq('user_id', session.user.id);
}
