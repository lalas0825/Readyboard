'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type PreflightData = {
  delayCount: number;
  nodCount: number;
  fieldReportCount: number;
  reaCount: number;
};

/**
 * Returns counts for pre-flight validation before PDF generation.
 * Used by Generate REA / Evidence Package modals to show tooltips
 * when data is insufficient.
 */
export async function fetchPreflightData(projectId: string): Promise<PreflightData> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const [delayRes, nodRes, reportRes, reaRes] = await Promise.all([
    supabase
      .from('delay_logs')
      .select('id', { count: 'exact', head: true })
      .eq('areas.project_id', projectId)
      .not('ended_at', 'is', null),

    supabase
      .from('legal_documents')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('type', 'nod')
      .not('sent_at', 'is', null),

    supabase
      .from('field_reports')
      .select('id', { count: 'exact', head: true })
      .eq('areas.project_id', projectId),

    supabase
      .from('legal_documents')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('type', 'rea'),
  ]);

  return {
    delayCount: delayRes.count ?? 0,
    nodCount: nodRes.count ?? 0,
    fieldReportCount: reportRes.count ?? 0,
    reaCount: reaRes.count ?? 0,
  };
}
