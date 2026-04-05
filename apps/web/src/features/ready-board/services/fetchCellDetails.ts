'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AreaTask = {
  id: string;
  task_order: number;
  task_name_en: string;
  task_name_es: string;
  task_owner: 'sub' | 'gc';
  is_gate: boolean;
  status: string;
  completed_at: string | null;
  photo_url: string | null;
};

export type AreaNote = {
  id: string;
  author_name: string;
  author_role: string;
  author_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
};

export type CellDetailData = {
  gps: { lat: number; lng: number } | null;
  photos: { url: string; created_at: string }[];
  reportHistory: { status: string; progress_pct: number; created_at: string }[];
  tasks: AreaTask[];
  startedAt: string | null;
  completedAt: string | null;
  notes: AreaNote[];
};

/**
 * Lazy-load service: fetches GPS, photos, and report history for a specific cell.
 * Called on-demand when the detail panel opens — NOT part of initial grid load.
 */
export async function fetchCellDetails(
  areaId: string,
  tradeName: string,
): Promise<CellDetailData> {
  const session = await getSession();
  const supabase = session?.isDevBypass
    ? createServiceClient()
    : await createClient();

  const empty: CellDetailData = {
    gps: null, photos: [], reportHistory: [], tasks: [],
    startedAt: null, completedAt: null, notes: [],
  };

  try {
    const [reportsResult, tasksResult, statusResult, notesResult] = await Promise.all([
      supabase
        .from('field_reports')
        .select('gps_lat, gps_lng, photo_url, status, progress_pct, created_at')
        .eq('area_id', areaId)
        .eq('trade_name', tradeName)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('area_tasks')
        .select('id, task_order, task_name_en, task_name_es, task_owner, is_gate, status, completed_at, photo_url')
        .eq('area_id', areaId)
        .eq('trade_type', tradeName)
        .order('task_order', { ascending: true }),
      supabase
        .from('area_trade_status')
        .select('started_at, completed_at')
        .eq('area_id', areaId)
        .eq('trade_type', tradeName)
        .maybeSingle(),
      supabase
        .from('area_notes')
        .select('id, author_id, author_name, author_role, content, is_system, created_at')
        .eq('area_id', areaId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const reports = reportsResult.data;
    const tasks = (tasksResult.data ?? []) as AreaTask[];
    const startedAt = statusResult.data?.started_at ?? null;
    const completedAt = statusResult.data?.completed_at ?? null;
    const notes: AreaNote[] = (notesResult.data ?? []).map((n) => ({
      id: n.id,
      author_id: n.author_id,
      author_name: n.author_name,
      author_role: n.author_role,
      content: n.content,
      is_system: Boolean(n.is_system),
      created_at: n.created_at,
    })).reverse(); // oldest first

    // GPS: first non-null coordinates from reports
    const gpsReport = (reports ?? []).find((r) => r.gps_lat != null && r.gps_lng != null);
    const gps = gpsReport
      ? { lat: Number(gpsReport.gps_lat), lng: Number(gpsReport.gps_lng) }
      : null;

    // Photos from field_reports (blocker/progress photos submitted with report)
    const reportPhotos = (reports ?? [])
      .filter((r) => r.photo_url)
      .map((r) => ({ url: r.photo_url!, created_at: r.created_at }));

    // Photos from area_tasks (per-task progress photos taken in checklist)
    const taskPhotos = tasks
      .filter((t) => t.photo_url)
      .map((t) => ({ url: t.photo_url!, created_at: t.completed_at ?? new Date().toISOString() }));

    // Merge: task photos first (most granular), then report photos
    const photos = [...taskPhotos, ...reportPhotos];

    // Report history: all reports as timeline events
    const reportHistory = (reports ?? []).map((r) => ({
      status: r.status ?? 'unknown',
      progress_pct: Number(r.progress_pct ?? 0),
      created_at: r.created_at,
    }));

    if (!reports || reports.length === 0) {
      return { ...empty, tasks, photos, startedAt, completedAt, notes };
    }

    return { gps, photos, reportHistory, tasks, startedAt, completedAt, notes };
  } catch {
    return empty;
  }
}
