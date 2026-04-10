'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type ScheduleBaselineRow = {
  id: string;
  projectId: string;
  tradeName: string;
  floor: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  durationDays: number | null;
};

function mapRow(r: Record<string, unknown>): ScheduleBaselineRow {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    tradeName: r.trade_name as string,
    floor: r.floor as string,
    plannedStart: (r.planned_start as string) ?? null,
    plannedEnd: (r.planned_end as string) ?? null,
    durationDays: (r.duration_days as number) ?? null,
  };
}

export async function fetchScheduleBaselines(
  projectId: string,
): Promise<ScheduleBaselineRow[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const { data } = await supabase
    .from('schedule_baselines')
    .select('id, project_id, trade_name, floor, planned_start, planned_end, duration_days')
    .eq('project_id', projectId)
    .order('trade_name')
    .order('floor');

  return (data ?? []).map(mapRow);
}
