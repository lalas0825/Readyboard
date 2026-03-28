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

const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';

const DEMO_BRIEFING_EN = `1. 3 areas blocked on Floor 22 — Drywall crew waiting on Fire Stopping inspection (FDNY). Cumulative cost: $14,400. NOD drafted for Bath 22C.
2. GC verification overdue on Floor 21: 4 tasks pending approval >24h (Tile, Waterproofing). Escalation sent to sub PM.
3. Today's priority: Clear Fire Stopping on F22 to unblock 6 areas. MEP Trim-Out on F20 is 2 days ahead of schedule — keep momentum.`;

/**
 * Fetches recent briefings for the current user.
 * Demo project returns hardcoded briefing instantly.
 */
export async function fetchRecentBriefings(
  projectId: string,
  limit = 7,
): Promise<BriefingEntry[]> {
  // Demo mode: instant hardcoded briefing
  if (projectId === DEMO_PROJECT_ID) {
    const today = new Date().toISOString().split('T')[0];
    return [{
      id: 'demo-briefing',
      content: DEMO_BRIEFING_EN,
      model: 'demo',
      language: 'en',
      readAt: null,
      createdAt: new Date().toISOString(),
      briefingDate: today,
    }];
  }

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
