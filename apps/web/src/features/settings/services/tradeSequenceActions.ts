'use server';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Trade-sequence mutations: duplicate as phase, create custom, delete custom.
 *
 * Architecture note: `trade_sequences` is stored per (project_id, area_type). A project
 * with bathroom/kitchen/corridor/office has 4 rows per trade. All mutations here apply
 * across every area_type used by the project to keep sequences in lockstep.
 *
 * Phase identity: when a trade has phases (e.g. "Metal Stud Framing" Phase 1 vs Phase 2),
 * the `area_trade_status.trade_type` uses a composite key `{trade_name}::{phase_label}`.
 * Trades with no phases use the plain `trade_name`. This keeps backward compatibility
 * with all existing queries that operate on trade_type strings.
 */

function tradeTypeKey(tradeName: string, phaseLabel?: string | null): string {
  return phaseLabel ? `${tradeName}::${phaseLabel}` : tradeName;
}

type AreaTypeRow = { area_type: string };

async function getProjectAreaTypes(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('trade_sequences')
    .select('area_type')
    .eq('project_id', projectId);
  const set = new Set<string>();
  for (const row of (data ?? []) as AreaTypeRow[]) set.add(row.area_type);
  return [...set];
}

// ---------------------------------------------------------------------------
// Duplicate a trade as a new phase
// ---------------------------------------------------------------------------

export async function duplicateTradeAsPhase(params: {
  projectId: string;
  sourceTradeName: string;
  phaseLabel: string;
  description?: string;
  insertAfterOrder: number;
  copyChecklist: boolean;
}): Promise<
  | { ok: true; tradeTypeKey: string }
  | { ok: false; error: string }
> {
  const supabase = createServiceClient();

  if (!params.phaseLabel.trim()) {
    return { ok: false, error: 'Phase label is required.' };
  }

  const newTradeTypeKey = tradeTypeKey(params.sourceTradeName, params.phaseLabel);

  // 1. Fetch the source trade (one row per area_type)
  const { data: sourceRows, error: sourceErr } = await supabase
    .from('trade_sequences')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('trade_name', params.sourceTradeName);

  if (sourceErr || !sourceRows || sourceRows.length === 0) {
    return { ok: false, error: `Source trade not found: ${params.sourceTradeName}` };
  }

  const areaTypes = sourceRows.map((r) => r.area_type as string);

  // 2. Shift sequence_order +1 for all rows > insertAfterOrder, per area_type
  for (const areaType of areaTypes) {
    const { error: shiftErr } = await supabase.rpc('shift_trade_sequence', {
      p_project_id: params.projectId,
      p_area_type: areaType,
      p_after_order: params.insertAfterOrder,
      p_shift_by: 1,
    });
    if (shiftErr) return { ok: false, error: `Shift failed: ${shiftErr.message}` };
  }

  // 3. Insert new trade_sequences row per area_type (same base trade_name, new phase_label)
  const newRows = sourceRows.map((src) => ({
    project_id: params.projectId,
    area_type: src.area_type,
    trade_name: src.trade_name,
    phase_label: params.phaseLabel,
    description: params.description ?? null,
    sequence_order: params.insertAfterOrder + 1,
    straight_time_hours: src.straight_time_hours,
    ot_multiplier: src.ot_multiplier,
    dt_multiplier: src.dt_multiplier,
    saturday_rule: src.saturday_rule,
    typical_crew: src.typical_crew,
    is_custom: false,
  }));

  const { error: insertErr } = await supabase.from('trade_sequences').insert(newRows);
  if (insertErr) return { ok: false, error: `Insert failed: ${insertErr.message}` };

  // 4. Create area_trade_status rows for every area in the project (composite trade_type key)
  const { error: statusErr } = await supabase.rpc('create_status_for_new_trade', {
    p_project_id: params.projectId,
    p_trade_type: newTradeTypeKey,
  });
  if (statusErr) return { ok: false, error: `Status seed failed: ${statusErr.message}` };

  // 5. Inherit reporting_mode from source via project_trade_configs
  const { data: sourceMode } = await supabase
    .from('project_trade_configs')
    .select('reporting_mode')
    .eq('project_id', params.projectId)
    .eq('trade_type', params.sourceTradeName)
    .maybeSingle();

  if (sourceMode?.reporting_mode) {
    await supabase.from('project_trade_configs').upsert(
      {
        project_id: params.projectId,
        trade_type: newTradeTypeKey,
        reporting_mode: sourceMode.reporting_mode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,trade_type' },
    );
  }

  // 6. Copy checklist templates if requested (per area_type)
  if (params.copyChecklist) {
    // Read source templates — prefer project-scoped, fall back to global defaults.
    const { data: projectTemplates } = await supabase
      .from('trade_task_templates')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('trade_type', params.sourceTradeName);

    let templatesToClone = projectTemplates ?? [];

    if (templatesToClone.length === 0) {
      // Fall back to global defaults
      const { data: globalTemplates } = await supabase
        .from('trade_task_templates')
        .select('*')
        .is('project_id', null)
        .is('org_id', null)
        .eq('trade_type', params.sourceTradeName);
      templatesToClone = globalTemplates ?? [];
    }

    if (templatesToClone.length > 0) {
      const newTemplates = templatesToClone.map((t) => ({
        project_id: params.projectId,
        org_id: null,
        trade_type: newTradeTypeKey,
        area_type: t.area_type,
        task_order: t.task_order,
        task_name_en: t.task_name_en,
        task_name_es: t.task_name_es,
        verification_criteria: t.verification_criteria,
        task_owner: t.task_owner,
        is_gate: t.is_gate,
        is_inspection: t.is_inspection,
        weight: t.weight,
        gate_timeout_hours: t.gate_timeout_hours,
        requires_photo: t.requires_photo,
        default_enabled: t.default_enabled ?? true,
      }));

      const { error: cloneErr } = await supabase
        .from('trade_task_templates')
        .insert(newTemplates);
      if (cloneErr) return { ok: false, error: `Template clone failed: ${cloneErr.message}` };

      // Sync into area_tasks for existing areas
      const { error: syncErr } = await supabase.rpc('sync_task_templates_to_areas', {
        p_project_id: params.projectId,
        p_trade_type: newTradeTypeKey,
      });
      if (syncErr) return { ok: false, error: `Sync failed: ${syncErr.message}` };
    }
  }

  // 7. Copy labor rates
  const { data: sourceRates } = await supabase
    .from('labor_rates')
    .select('role, hourly_rate')
    .eq('project_id', params.projectId)
    .eq('trade_name', params.sourceTradeName);

  if (sourceRates && sourceRates.length > 0) {
    const newRates = sourceRates.map((r) => ({
      project_id: params.projectId,
      trade_name: newTradeTypeKey,
      role: r.role,
      hourly_rate: r.hourly_rate,
    }));
    await supabase
      .from('labor_rates')
      .upsert(newRates, { onConflict: 'project_id,trade_name,role' });
  }

  return { ok: true, tradeTypeKey: newTradeTypeKey };
}

// ---------------------------------------------------------------------------
// Create a brand-new custom trade
// ---------------------------------------------------------------------------

export async function createCustomTrade(params: {
  projectId: string;
  tradeName: string;
  phaseLabel?: string;
  description?: string;
  insertAfterOrder: number;
  reportingMode: 'percentage' | 'checklist';
}): Promise<
  | { ok: true; tradeTypeKey: string }
  | { ok: false; error: string }
> {
  const supabase = createServiceClient();

  if (!params.tradeName.trim()) {
    return { ok: false, error: 'Trade name is required.' };
  }

  const newTradeTypeKey = tradeTypeKey(params.tradeName, params.phaseLabel);

  // Determine which area_types this project uses
  const areaTypes = await getProjectAreaTypes(supabase, params.projectId);
  if (areaTypes.length === 0) {
    return { ok: false, error: 'Project has no trade sequences yet. Complete onboarding first.' };
  }

  // 1. Shift sequence +1 for every area_type
  for (const areaType of areaTypes) {
    const { error: shiftErr } = await supabase.rpc('shift_trade_sequence', {
      p_project_id: params.projectId,
      p_area_type: areaType,
      p_after_order: params.insertAfterOrder,
      p_shift_by: 1,
    });
    if (shiftErr) return { ok: false, error: `Shift failed: ${shiftErr.message}` };
  }

  // 2. Insert trade_sequences row per area_type
  const defaultCrew = { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 };
  const newRows = areaTypes.map((at) => ({
    project_id: params.projectId,
    area_type: at,
    trade_name: params.tradeName,
    phase_label: params.phaseLabel ?? null,
    description: params.description ?? null,
    sequence_order: params.insertAfterOrder + 1,
    straight_time_hours: 8,
    ot_multiplier: 1.5,
    dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: defaultCrew,
    is_custom: true,
  }));

  const { error: insertErr } = await supabase.from('trade_sequences').insert(newRows);
  if (insertErr) return { ok: false, error: `Insert failed: ${insertErr.message}` };

  // 3. Create area_trade_status for every area
  const { error: statusErr } = await supabase.rpc('create_status_for_new_trade', {
    p_project_id: params.projectId,
    p_trade_type: newTradeTypeKey,
  });
  if (statusErr) return { ok: false, error: `Status seed failed: ${statusErr.message}` };

  // 4. Store reporting mode
  await supabase.from('project_trade_configs').upsert(
    {
      project_id: params.projectId,
      trade_type: newTradeTypeKey,
      reporting_mode: params.reportingMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,trade_type' },
  );

  // 5. Seed default labor rates (NYC baseline for an unknown custom trade)
  const defaultRates = [
    { role: 'foreman', hourly_rate: 100 },
    { role: 'journeyperson', hourly_rate: 85 },
    { role: 'apprentice', hourly_rate: 50 },
    { role: 'helper', hourly_rate: 40 },
  ];
  await supabase.from('labor_rates').insert(
    defaultRates.map((r) => ({
      project_id: params.projectId,
      trade_name: newTradeTypeKey,
      role: r.role,
      hourly_rate: r.hourly_rate,
    })),
  );

  // No checklist templates yet — the GC will create them in the ChecklistEditor.

  return { ok: true, tradeTypeKey: newTradeTypeKey };
}

// ---------------------------------------------------------------------------
// Delete a custom trade (cascade)
// ---------------------------------------------------------------------------

export async function deleteCustomTrade(params: {
  projectId: string;
  tradeName: string;
  phaseLabel?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  const key = tradeTypeKey(params.tradeName, params.phaseLabel);

  // 1. Fetch the trade_sequences rows (should all be is_custom=true)
  const query = supabase
    .from('trade_sequences')
    .select('id, area_type, sequence_order, is_custom, phase_label')
    .eq('project_id', params.projectId)
    .eq('trade_name', params.tradeName);

  const { data: rows, error: fetchErr } = params.phaseLabel
    ? await query.eq('phase_label', params.phaseLabel)
    : await query.is('phase_label', null);

  if (fetchErr) return { ok: false, error: `Lookup failed: ${fetchErr.message}` };
  if (!rows || rows.length === 0) {
    return { ok: false, error: 'Trade not found.' };
  }
  if (rows.some((r) => !r.is_custom)) {
    return { ok: false, error: 'Only custom trades can be deleted.' };
  }

  // 2. Collect the project's area ids for scoped cascade deletes
  const { data: projectAreas } = await supabase
    .from('areas')
    .select('id')
    .eq('project_id', params.projectId);
  const areaIds = (projectAreas ?? []).map((a) => a.id);

  if (areaIds.length > 0) {
    // Delete area_tasks for this trade
    await supabase
      .from('area_tasks')
      .delete()
      .eq('trade_type', key)
      .in('area_id', areaIds);

    // Delete area_trade_status for this trade
    await supabase
      .from('area_trade_status')
      .delete()
      .eq('trade_type', key)
      .in('area_id', areaIds);
  }

  // 3. Delete project-scoped templates for this trade
  await supabase
    .from('trade_task_templates')
    .delete()
    .eq('project_id', params.projectId)
    .eq('trade_type', key);

  // 4. Delete labor rates
  await supabase
    .from('labor_rates')
    .delete()
    .eq('project_id', params.projectId)
    .eq('trade_name', key);

  // 5. Delete project_trade_configs entry
  await supabase
    .from('project_trade_configs')
    .delete()
    .eq('project_id', params.projectId)
    .eq('trade_type', key);

  // 6. Delete the trade_sequences rows and shift remaining down
  const shiftAnchors: { area_type: string; order: number }[] = rows.map((r) => ({
    area_type: r.area_type as string,
    order: (r.sequence_order as number) - 1,
  }));

  const { error: delErr } = await supabase
    .from('trade_sequences')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    );
  if (delErr) return { ok: false, error: `Delete failed: ${delErr.message}` };

  for (const anchor of shiftAnchors) {
    await supabase.rpc('shift_trade_sequence', {
      p_project_id: params.projectId,
      p_area_type: anchor.area_type,
      p_after_order: anchor.order,
      p_shift_by: -1,
    });
  }

  return { ok: true };
}
