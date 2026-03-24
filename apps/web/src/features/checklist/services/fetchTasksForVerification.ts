'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type VerificationTask = {
  id: string;
  taskOrder: number;
  taskNameEn: string;
  taskNameEs: string;
  taskOwner: 'sub' | 'gc';
  isGate: boolean;
  weight: number;
  status: string;
  completedAt: string | null;
  completedBy: string | null;
  photoUrl: string | null;
  notes: string | null;
  correctionReason: string | null;
  correctionNote: string | null;
};

/**
 * Fetches all tasks for a specific area/trade combination.
 * Used by ChecklistDetailView so GC can see what SUB completed.
 */
export async function fetchTasksForVerification(
  areaId: string,
  tradeType: string,
): Promise<VerificationTask[]> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('area_tasks')
    .select(`
      id, task_order, task_name_en, task_name_es,
      task_owner, is_gate, weight, status,
      completed_at, completed_by, photo_url, notes,
      correction_reason, correction_note
    `)
    .eq('area_id', areaId)
    .eq('trade_type', tradeType)
    .order('task_order', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    taskOrder: (row.task_order as number) ?? 0,
    taskNameEn: (row.task_name_en as string) ?? '',
    taskNameEs: (row.task_name_es as string) ?? '',
    taskOwner: (row.task_owner as 'sub' | 'gc') ?? 'sub',
    isGate: (row.is_gate as boolean) ?? false,
    weight: (row.weight as number) ?? 0,
    status: (row.status as string) ?? 'pending',
    completedAt: (row.completed_at as string) ?? null,
    completedBy: (row.completed_by as string) ?? null,
    photoUrl: (row.photo_url as string) ?? null,
    notes: (row.notes as string) ?? null,
    correctionReason: (row.correction_reason as string) ?? null,
    correctionNote: (row.correction_note as string) ?? null,
  }));
}
