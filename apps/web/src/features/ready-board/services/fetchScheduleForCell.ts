'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type CellScheduleBaseline = {
  plannedStart: string | null;
  plannedEnd: string | null;
  floor: string;
} | null;

/**
 * Fetch the schedule baseline for a specific area × trade.
 * Looks up the area's floor, then queries schedule_baselines.
 */
export async function fetchScheduleForCell(
  projectId: string,
  areaId: string,
  tradeName: string,
): Promise<CellScheduleBaseline> {
  const session = await getSession();
  if (!session) return null;

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  // Get the floor for this area
  const { data: area } = await supabase
    .from('areas')
    .select('floor')
    .eq('id', areaId)
    .single();

  if (!area?.floor) return null;

  const { data } = await supabase
    .from('schedule_baselines')
    .select('planned_start, planned_end')
    .eq('project_id', projectId)
    .eq('trade_name', tradeName)
    .eq('floor', area.floor)
    .maybeSingle();

  if (!data) return null;
  return {
    plannedStart: (data.planned_start as string) ?? null,
    plannedEnd: (data.planned_end as string) ?? null,
    floor: area.floor,
  };
}
