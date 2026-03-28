import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { refreshAllProjectForecasts } from '@/features/forecast/services/forecastCron';

/**
 * POST /api/forecast/refresh
 *
 * Refreshes forecast snapshots for all active projects.
 * Called by cron job every 6 hours or manually for testing.
 *
 * Security: requires CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshAllProjectForecasts();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Forecast Cron] Failed:', err);
    return NextResponse.json({ error: 'Forecast refresh failed' }, { status: 500 });
  }
}
