'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { deriveActionStatus } from '../lib/deriveActionStatus';
import type { CorrectiveActionStatus } from '../types';

// ─── Types ──────────────────────────────────────────

export type CAItem = {
  id: string;
  delayLogId: string;
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  assignedToName: string;
  deadline: string;
  note: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  status: CorrectiveActionStatus;
  isOverdue: boolean;
  daysToDeadline: number;
  cumulativeCost: number;
};

export type CAPageData = {
  items: CAItem[];
  projectId: string;
  metrics: {
    total: number;
    open: number;
    acknowledged: number;
    inProgress: number;
    resolved: number;
    overdue: number;
    avgResolutionHours: number | null;
  };
};

// ─── Fetch ──────────────────────────────────────────

export async function fetchCorrectiveActions(
  projectId?: string,
): Promise<CAPageData> {
  const session = await getSession();
  if (!session) return emptyData();

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  // Resolve projectId
  let pid = projectId;
  if (!pid) {
    const { data: p } = await supabase.from('projects').select('id').limit(1).single();
    pid = p?.id;
  }
  if (!pid) return emptyData();

  const { data: rows, error } = await supabase
    .from('corrective_actions')
    .select(`
      id,
      delay_log_id,
      assigned_to,
      deadline,
      note,
      created_at,
      acknowledged_at,
      in_resolution_at,
      resolved_at,
      users!corrective_actions_assigned_to_fkey ( name ),
      delay_logs!inner (
        area_id,
        trade_name,
        reason_code,
        cumulative_cost,
        areas!inner ( name, floor, project_id )
      )
    `)
    .eq('delay_logs.areas.project_id', pid)
    .order('created_at', { ascending: false });

  if (error || !rows) return { ...emptyData(), projectId: pid };

  const now = Date.now();
  const MS_PER_HOUR = 3_600_000;

  const items: CAItem[] = rows.map((row) => {
    const dl = row.delay_logs as unknown as Record<string, unknown>;
    const area = dl.areas as unknown as Record<string, unknown>;
    const user = row.users as unknown as Record<string, unknown>;
    const deadline = new Date(row.deadline).getTime();
    const status = deriveActionStatus({
      resolved_at: row.resolved_at,
      in_resolution_at: row.in_resolution_at,
      acknowledged_at: row.acknowledged_at,
    });

    return {
      id: row.id,
      delayLogId: row.delay_log_id,
      areaName: (area?.name as string) ?? 'Unknown',
      floor: (area?.floor as string) ?? '?',
      tradeName: (dl.trade_name as string) ?? '',
      reasonCode: (dl.reason_code as string) ?? '',
      assignedToName: (user?.name as string) ?? 'Unassigned',
      deadline: row.deadline,
      note: row.note,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      status,
      isOverdue: status !== 'resolved' && deadline < now,
      daysToDeadline: Math.round((deadline - now) / (MS_PER_HOUR * 24)),
      cumulativeCost: Number(dl.cumulative_cost ?? 0),
    };
  });

  // Metrics
  const open = items.filter((i) => i.status === 'open').length;
  const acknowledged = items.filter((i) => i.status === 'acknowledged').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const resolved = items.filter((i) => i.status === 'resolved').length;
  const overdue = items.filter((i) => i.isOverdue).length;

  // Average time to resolution (only for resolved items)
  const resolvedItems = items.filter((i) => i.resolvedAt);
  let avgResolutionHours: number | null = null;
  if (resolvedItems.length > 0) {
    const totalHours = resolvedItems.reduce((sum, i) => {
      const created = new Date(i.createdAt).getTime();
      const resolved = new Date(i.resolvedAt!).getTime();
      return sum + (resolved - created) / MS_PER_HOUR;
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedItems.length) * 10) / 10;
  }

  return {
    items,
    projectId: pid,
    metrics: {
      total: items.length,
      open,
      acknowledged,
      inProgress,
      resolved,
      overdue,
      avgResolutionHours,
    },
  };
}

// ─── Helpers ────────────────────────────────────────

function emptyData(): CAPageData {
  return {
    items: [],
    projectId: '',
    metrics: { total: 0, open: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0, avgResolutionHours: null },
  };
}
