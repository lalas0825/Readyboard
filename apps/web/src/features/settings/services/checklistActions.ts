'use server';

import { createServiceClient } from '@/lib/supabase/service';

export type TaskTemplateRow = {
  id: string;
  trade_type: string;
  area_type: string;
  task_order: number;
  task_name_en: string;
  task_name_es: string;
  task_owner: 'sub' | 'gc';
  is_gate: boolean;
  is_inspection: boolean;
  weight: number;
  gate_timeout_hours: number | null;
  requires_photo: boolean;
  default_enabled: boolean;
  verification_criteria: string | null;
};

/**
 * Fetch the editable checklist for a given (project, trade_type, area_type).
 *
 * If the project has no project-scoped templates yet, clones the global defaults
 * into project-scoped rows and remaps existing area_tasks to the new ids.
 * This is the first-edit initialization path.
 */
export async function getTradeChecklist(
  projectId: string,
  tradeType: string,
  areaType: string,
): Promise<TaskTemplateRow[]> {
  const supabase = createServiceClient();

  // Lazy init: clones global → project on first open (no-op if already initialized)
  await supabase.rpc('initialize_project_checklist', {
    p_project_id: projectId,
    p_trade_type: tradeType,
    p_area_type: areaType,
  });

  const { data, error } = await supabase
    .from('trade_task_templates')
    .select(
      'id, trade_type, area_type, task_order, task_name_en, task_name_es, task_owner, is_gate, is_inspection, weight, gate_timeout_hours, requires_photo, default_enabled, verification_criteria',
    )
    .eq('project_id', projectId)
    .eq('trade_type', tradeType)
    .eq('area_type', areaType)
    .order('task_order', { ascending: true });

  if (error) {
    console.error('[getTradeChecklist] query error:', error);
    return [];
  }

  return (data ?? []) as TaskTemplateRow[];
}

export type SaveTaskInput = {
  id: string; // existing id or a fresh uuid for new tasks
  task_name_en: string;
  task_name_es: string;
  task_owner: 'sub' | 'gc';
  is_gate: boolean;
  weight: number;
};

/**
 * Save the full checklist for a (project, trade_type, area_type).
 *
 * Strategy:
 * - Deletes templates removed from the list.
 * - Removes their pending area_tasks (never completed tasks — those stay as evidence).
 * - Upserts the remaining tasks (new + edited).
 * - Syncs new tasks into area_tasks for existing areas.
 * - Updates pending area_tasks to reflect name/owner/gate/weight/order changes.
 */
export async function saveTradeChecklist(params: {
  projectId: string;
  tradeType: string;
  areaType: string;
  tasks: SaveTaskInput[];
}): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  // Ensure project-scoped templates exist (no-op if already initialized)
  await supabase.rpc('initialize_project_checklist', {
    p_project_id: params.projectId,
    p_trade_type: params.tradeType,
    p_area_type: params.areaType,
  });

  // 1. Fetch current project-scoped templates
  const { data: existing, error: fetchErr } = await supabase
    .from('trade_task_templates')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('trade_type', params.tradeType)
    .eq('area_type', params.areaType);

  if (fetchErr) return { ok: false, error: `Fetch failed: ${fetchErr.message}` };

  const existingIds = new Set((existing ?? []).map((t) => t.id));
  const incomingIds = new Set(params.tasks.map((t) => t.id));
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));

  // 2. Delete removed templates + their pending area_tasks (keep completed as evidence)
  if (toDelete.length > 0) {
    // Delete pending area_tasks referencing those templates
    const { error: taskDelErr } = await supabase
      .from('area_tasks')
      .delete()
      .in('task_template_id', toDelete)
      .eq('status', 'pending');
    if (taskDelErr) return { ok: false, error: `Task cleanup failed: ${taskDelErr.message}` };

    // Null out completed task references before deleting the template,
    // so the FK ON DELETE SET NULL takes effect gracefully.
    const { error: delErr } = await supabase
      .from('trade_task_templates')
      .delete()
      .in('id', toDelete);
    if (delErr) return { ok: false, error: `Template delete failed: ${delErr.message}` };
  }

  // 3. Upsert the current tasks
  const upsertRows = params.tasks.map((t, i) => ({
    id: t.id,
    project_id: params.projectId,
    org_id: null,
    trade_type: params.tradeType,
    area_type: params.areaType,
    task_order: i + 1,
    task_name_en: t.task_name_en,
    task_name_es: t.task_name_es || '',
    task_owner: t.task_owner,
    is_gate: t.is_gate,
    is_inspection: false,
    weight: t.weight,
    default_enabled: true,
  }));

  if (upsertRows.length > 0) {
    const { error: upErr } = await supabase
      .from('trade_task_templates')
      .upsert(upsertRows, { onConflict: 'id' });
    if (upErr) return { ok: false, error: `Upsert failed: ${upErr.message}` };
  }

  // 4. Sync new tasks into area_tasks for existing areas (additive, ON CONFLICT DO NOTHING)
  const { error: syncErr } = await supabase.rpc('sync_task_templates_to_areas', {
    p_project_id: params.projectId,
    p_trade_type: params.tradeType,
  });
  if (syncErr) return { ok: false, error: `Sync failed: ${syncErr.message}` };

  // 5. Propagate edits to pending area_tasks (name/owner/gate/weight/order)
  //    Completed area_tasks are untouched — they are historical evidence.
  for (let i = 0; i < params.tasks.length; i++) {
    const task = params.tasks[i]!;
    if (!existingIds.has(task.id)) continue;

    const { error: upTaskErr } = await supabase
      .from('area_tasks')
      .update({
        task_name_en: task.task_name_en,
        task_name_es: task.task_name_es || '',
        task_owner: task.task_owner,
        is_gate: task.is_gate,
        weight: task.weight,
        task_order: i + 1,
      })
      .eq('task_template_id', task.id)
      .eq('status', 'pending');

    if (upTaskErr) {
      console.warn(
        '[saveTradeChecklist] non-fatal task update failed:',
        task.id,
        upTaskErr.message,
      );
    }
  }

  return { ok: true, saved: params.tasks.length };
}
