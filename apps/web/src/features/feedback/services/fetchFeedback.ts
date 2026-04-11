'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type FeedbackReport = {
  id: string;
  projectId: string | null;
  reportedBy: string;
  reporterName: string | null;
  reporterRole: string | null;
  type: 'bug' | 'feature_request' | 'feedback' | 'question';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  pageUrl: string | null;
  appSource: 'web' | 'mobile';
  deviceInfo: string | null;
  screenshots: string[];
  status: 'new' | 'reviewing' | 'in_progress' | 'resolved' | 'wont_fix' | 'duplicate';
  adminNotes: string | null;
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type FeedbackSummary = {
  new: number;
  reviewing: number;
  in_progress: number;
  resolved: number;
};

export async function fetchFeedback(projectId: string): Promise<{
  reports: FeedbackReport[];
  summary: FeedbackSummary;
}> {
  const session = await getSession();
  if (!session || session.user.role !== 'gc_admin') {
    return { reports: [], summary: { new: 0, reviewing: 0, in_progress: 0, resolved: 0 } };
  }

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const { data } = await supabase
    .from('feedback_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const reports: FeedbackReport[] = (data ?? []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    reportedBy: r.reported_by,
    reporterName: r.reporter_name,
    reporterRole: r.reporter_role,
    type: r.type as FeedbackReport['type'],
    severity: (r.severity ?? 'medium') as FeedbackReport['severity'],
    title: r.title,
    description: r.description,
    pageUrl: r.page_url,
    appSource: (r.app_source ?? 'web') as FeedbackReport['appSource'],
    deviceInfo: r.device_info,
    screenshots: Array.isArray(r.screenshots) ? (r.screenshots as string[]) : [],
    status: (r.status ?? 'new') as FeedbackReport['status'],
    adminNotes: r.admin_notes,
    adminResponse: r.admin_response,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
  }));

  const summary: FeedbackSummary = {
    new: reports.filter((r) => r.status === 'new').length,
    reviewing: reports.filter((r) => r.status === 'reviewing').length,
    in_progress: reports.filter((r) => r.status === 'in_progress').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  };

  return { reports, summary };
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackReport['status'],
  adminNotes?: string,
  adminResponse?: string,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || session.user.role !== 'gc_admin') return { ok: false };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const updates: Record<string, unknown> = { status };
  if (adminNotes !== undefined) updates.admin_notes = adminNotes;
  if (adminResponse !== undefined) updates.admin_response = adminResponse;
  if (status === 'resolved') updates.resolved_at = new Date().toISOString();

  const { error } = await supabase.from('feedback_reports').update(updates).eq('id', id);
  return { ok: !error };
}

export async function countNewFeedback(): Promise<number> {
  const session = await getSession();
  if (!session || session.user.role !== 'gc_admin') return 0;

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const { count } = await supabase
    .from('feedback_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');

  return count ?? 0;
}
