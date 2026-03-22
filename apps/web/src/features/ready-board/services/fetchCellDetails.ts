'use server';

import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type CellDetailData = {
  gps: { lat: number; lng: number } | null;
  photos: { url: string; created_at: string }[];
  reportHistory: { status: string; progress_pct: number; created_at: string }[];
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

  try {
    const { data: reports } = await supabase
      .from('field_reports')
      .select('gps_lat, gps_lng, photo_url, status, progress_pct, created_at')
      .eq('area_id', areaId)
      .eq('trade_name', tradeName)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!reports || reports.length === 0) {
      return { gps: null, photos: [], reportHistory: [] };
    }

    // GPS: first non-null coordinates
    const gpsReport = reports.find((r) => r.gps_lat != null && r.gps_lng != null);
    const gps = gpsReport
      ? { lat: Number(gpsReport.gps_lat), lng: Number(gpsReport.gps_lng) }
      : null;

    // Photos: all non-null photo_urls
    const photos = reports
      .filter((r) => r.photo_url)
      .map((r) => ({ url: r.photo_url!, created_at: r.created_at }));

    // Report history: all reports as timeline events
    const reportHistory = reports.map((r) => ({
      status: r.status ?? 'unknown',
      progress_pct: Number(r.progress_pct ?? 0),
      created_at: r.created_at,
    }));

    return { gps, photos, reportHistory };
  } catch {
    return { gps: null, photos: [], reportHistory: [] };
  }
}
