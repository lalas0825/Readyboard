'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type TradeConfigItem = {
  tradeType: string;
  sequenceOrder: number;
  reportingMode: 'percentage' | 'checklist';
  activeTaskCount: number;
  completedTaskCount: number;
  updatedAt: string | null;
};

/**
 * Fetches trade configuration for all trades in a project.
 * Joins trade_sequences + project_trade_configs for each trade.
 * Uses service client for task counts (cross-RLS aggregation).
 */
export async function fetchTradeConfigs(
  projectId: string,
): Promise<TradeConfigItem[]> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Get all trade types for this project
  const { data: trades } = await supabase
    .from('trade_sequences')
    .select('trade_name, sequence_order')
    .eq('project_id', projectId)
    .order('sequence_order', { ascending: true });

  if (!trades || trades.length === 0) return [];

  // Get existing configs
  const { data: configs } = await supabase
    .from('project_trade_configs')
    .select('trade_type, reporting_mode, updated_at')
    .eq('project_id', projectId);

  const configMap = new Map(
    (configs ?? []).map((c) => [c.trade_type, c]),
  );

  // Get task counts per trade using service client (for lock detection)
  const service = createServiceClient();
  const tradeTypes = trades.map((t) => t.trade_name);

  // Get area IDs for this project
  const { data: projectAreas } = await service
    .from('areas')
    .select('id')
    .eq('project_id', projectId);

  const areaIds = (projectAreas ?? []).map((a) => a.id);

  let taskCountMap = new Map<string, { active: number; completed: number }>();

  if (areaIds.length > 0) {
    const { data: tasks } = await service
      .from('area_tasks')
      .select('trade_type, status')
      .in('area_id', areaIds)
      .in('trade_type', tradeTypes);

    // Aggregate counts
    for (const task of tasks ?? []) {
      const existing = taskCountMap.get(task.trade_type) ?? { active: 0, completed: 0 };
      if (task.status === 'pending' || task.status === 'correction_requested') {
        existing.active++;
      } else if (task.status === 'complete') {
        existing.completed++;
      }
      taskCountMap.set(task.trade_type, existing);
    }
  }

  return trades.map((t) => {
    const config = configMap.get(t.trade_name);
    const counts = taskCountMap.get(t.trade_name);
    return {
      tradeType: t.trade_name,
      sequenceOrder: t.sequence_order,
      reportingMode: (config?.reporting_mode ?? 'percentage') as 'percentage' | 'checklist',
      activeTaskCount: counts?.active ?? 0,
      completedTaskCount: counts?.completed ?? 0,
      updatedAt: config?.updated_at ?? null,
    };
  });
}
