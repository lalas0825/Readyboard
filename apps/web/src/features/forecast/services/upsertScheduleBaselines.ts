'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';

export type BaselineInput = {
  floor: string;
  tradeName: string;
  plannedStart: string | null;
  plannedEnd: string | null;
};

export async function upsertScheduleBaselines(
  projectId: string,
  rows: BaselineInput[],
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Not authenticated' };

  // Only rows with at least one date set
  const validRows = rows.filter((r) => r.plannedStart || r.plannedEnd);
  if (validRows.length === 0) return { success: true };

  const supabase = createServiceClient();

  const { error } = await supabase.from('schedule_baselines').upsert(
    validRows.map((r) => ({
      project_id: projectId,
      trade_name: r.tradeName,
      floor: r.floor,
      planned_start: r.plannedStart || null,
      planned_end: r.plannedEnd || null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'project_id,trade_name,floor' },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}
