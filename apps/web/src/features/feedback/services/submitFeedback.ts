'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type FeedbackInput = {
  projectId?: string;
  type: 'bug' | 'feature_request' | 'feedback' | 'question';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  pageUrl?: string;
  deviceInfo?: string;
  screenshots?: string[]; // Storage URLs
};

export async function submitFeedback(input: FeedbackInput): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const { error } = await supabase.from('feedback_reports').insert({
    project_id: input.projectId ?? null,
    reported_by: session.user.id,
    reporter_name: session.user.name ?? null,
    reporter_role: session.user.role,
    type: input.type,
    severity: input.type === 'bug' ? (input.severity ?? 'medium') : 'medium',
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    page_url: input.pageUrl ?? null,
    app_source: 'web',
    device_info: input.deviceInfo ?? null,
    screenshots: input.screenshots ? JSON.stringify(input.screenshots) : '[]',
    status: 'new',
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
