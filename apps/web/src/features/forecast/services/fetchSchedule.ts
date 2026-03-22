'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ScheduleItemRow } from '../types';

function mapRow(r: Record<string, unknown>): ScheduleItemRow {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    areaName: r.area_name as string,
    tradeName: r.trade_name as string,
    plannedStart: (r.planned_start as string) ?? null,
    plannedFinish: (r.planned_finish as string) ?? null,
    baselineFinish: (r.baseline_finish as string) ?? null,
    actualFinish: (r.actual_finish as string) ?? null,
    p6ActivityId: (r.p6_activity_id as string) ?? null,
    areaId: (r.area_id as string) ?? null,
    isCritical: (r.is_critical as boolean) ?? false,
  };
}

export async function fetchScheduleItems(projectId: string): Promise<ScheduleItemRow[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const { data } = await supabase
    .from('schedule_items')
    .select('*')
    .eq('project_id', projectId)
    .order('planned_finish');

  return (data ?? []).map(mapRow);
}

export async function fetchCriticalPath(projectId: string): Promise<ScheduleItemRow[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  const { data } = await supabase
    .from('schedule_items')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_critical', true)
    .order('planned_finish');

  return (data ?? []).map(mapRow);
}
