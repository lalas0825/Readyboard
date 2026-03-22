'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { MS_PER_HOUR } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────

export type NodDraftRow = {
  id: string;
  delayLogId: string;
  areaName: string;
  floor: string;
  tradeName: string;
  reasonCode: string;
  cumulativeCost: number;
  draftPdfPath: string | null;
  createdAt: string;
  hoursSinceCreation: number;
};

// ─── Service ────────────────────────────────────────

/**
 * Fetches all unsent NOD drafts for a project.
 * Used by NodDraftsSection in the GC Dashboard.
 */
export async function fetchNodDrafts(
  projectId: string,
): Promise<NodDraftRow[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = session.isDevBypass
    ? createServiceClient()
    : await createClient();

  const { data, error } = await supabase
    .from('nod_drafts')
    .select(`
      id, draft_pdf_path, created_at,
      delay_logs!inner (
        id, trade_name, reason_code, cumulative_cost,
        areas!inner ( name, floor, project_id )
      )
    `)
    .is('sent_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const now = Date.now();

  return data
    .filter((d) => {
      const log = d.delay_logs as unknown as Record<string, unknown>;
      const area = log.areas as unknown as Record<string, unknown>;
      return area.project_id === projectId;
    })
    .map((d) => {
      const log = d.delay_logs as unknown as Record<string, unknown>;
      const area = log.areas as unknown as Record<string, unknown>;

      return {
        id: d.id,
        delayLogId: log.id as string,
        areaName: (area.name as string) ?? 'Unknown',
        floor: (area.floor as string) ?? '?',
        tradeName: (log.trade_name as string) ?? '',
        reasonCode: (log.reason_code as string) ?? '',
        cumulativeCost: Number(log.cumulative_cost ?? 0),
        draftPdfPath: d.draft_pdf_path,
        createdAt: d.created_at,
        hoursSinceCreation: Math.round((now - new Date(d.created_at).getTime()) / MS_PER_HOUR),
      };
    });
}
