'use server';

import { createServiceClient } from '@/lib/supabase/service';

export type TradeSequenceItem = {
  /** Composite key used in area_trade_status.trade_type */
  key: string;
  tradeName: string;
  phaseLabel: string | null;
  description: string | null;
  sequenceOrder: number;
  isCustom: boolean;
  reportingMode: 'percentage' | 'checklist';
  activeTaskCount: number;
  completedTaskCount: number;
};

function tradeTypeKey(tradeName: string, phaseLabel: string | null): string {
  return phaseLabel ? `${tradeName}::${phaseLabel}` : tradeName;
}

/**
 * Fetch the deduplicated trade sequence for a project.
 *
 * trade_sequences stores one row per (trade_name, phase_label, area_type). We dedupe
 * across area_types here so the UI shows each (trade, phase) once. The `key` field is
 * the composite trade_type used everywhere downstream (area_trade_status, area_tasks).
 */
export async function fetchTradeSequence(projectId: string): Promise<TradeSequenceItem[]> {
  const supabase = createServiceClient();

  // Pull all rows, ordered by sequence_order, then dedupe by (trade_name, phase_label)
  const { data: rows, error } = await supabase
    .from('trade_sequences')
    .select('trade_name, phase_label, description, sequence_order, is_custom')
    .eq('project_id', projectId)
    .order('sequence_order', { ascending: true });

  if (error || !rows) {
    console.error('[fetchTradeSequence] query failed:', error);
    return [];
  }

  type Row = {
    trade_name: string;
    phase_label: string | null;
    description: string | null;
    sequence_order: number;
    is_custom: boolean | null;
  };

  const seen = new Map<string, TradeSequenceItem>();
  for (const r of rows as Row[]) {
    const key = tradeTypeKey(r.trade_name, r.phase_label);
    if (seen.has(key)) continue;
    seen.set(key, {
      key,
      tradeName: r.trade_name,
      phaseLabel: r.phase_label,
      description: r.description,
      sequenceOrder: r.sequence_order,
      isCustom: r.is_custom ?? false,
      reportingMode: 'percentage',
      activeTaskCount: 0,
      completedTaskCount: 0,
    });
  }

  const trades = [...seen.values()];
  if (trades.length === 0) return [];

  // Reporting mode from project_trade_configs
  const keys = trades.map((t) => t.key);
  const { data: configs } = await supabase
    .from('project_trade_configs')
    .select('trade_type, reporting_mode')
    .eq('project_id', projectId)
    .in('trade_type', keys);

  const modeMap = new Map<string, 'percentage' | 'checklist'>();
  for (const c of configs ?? []) {
    modeMap.set(c.trade_type, c.reporting_mode as 'percentage' | 'checklist');
  }

  // Task counts from area_tasks
  const { data: projectAreas } = await supabase
    .from('areas')
    .select('id')
    .eq('project_id', projectId);
  const areaIds = (projectAreas ?? []).map((a) => a.id);

  const counts = new Map<string, { active: number; completed: number }>();
  if (areaIds.length > 0) {
    const { data: tasks } = await supabase
      .from('area_tasks')
      .select('trade_type, status')
      .in('area_id', areaIds)
      .in('trade_type', keys);

    for (const t of tasks ?? []) {
      const e = counts.get(t.trade_type) ?? { active: 0, completed: 0 };
      if (t.status === 'pending' || t.status === 'correction_requested') e.active++;
      else if (t.status === 'complete') e.completed++;
      counts.set(t.trade_type, e);
    }
  }

  return trades.map((t) => ({
    ...t,
    reportingMode: modeMap.get(t.key) ?? 'percentage',
    activeTaskCount: counts.get(t.key)?.active ?? 0,
    completedTaskCount: counts.get(t.key)?.completed ?? 0,
  }));
}

/**
 * Persist a new order for the trade sequence.
 * Accepts the UI's deduped list in the new order.
 */
export async function reorderTradeSequence(
  projectId: string,
  ordered: { tradeName: string; phaseLabel: string | null }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  const payload = ordered.map((o) => ({
    trade_name: o.tradeName,
    phase_label: o.phaseLabel,
  }));

  const { error } = await supabase.rpc('reorder_trade_sequence', {
    p_project_id: projectId,
    p_ordered: payload,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
