import { NextRequest, NextResponse } from 'next/server';
import { refreshAllProjectForecasts } from '@/features/forecast/services/forecastCron';
import { logCronRun } from '@/lib/cronLogger';

/**
 * POST /api/forecast/refresh
 *
 * Refreshes forecast snapshots for all active projects.
 * Cron: every 6 hours (0 *​/6 * * *).
 * Idempotent: upserts on (project, area, trade, date) unique constraint.
 *
 * Security: requires CRON_SECRET header or Vercel cron header.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== 'development') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startMs = Date.now();

  try {
    const result = await refreshAllProjectForecasts();
    const durationMs = Date.now() - startMs;

    const status = result.errors.length > 0
      ? (result.projectsProcessed > 0 ? 'partial' : 'failed')
      : 'success';

    void logCronRun({
      job_name: 'forecast_refresh',
      status,
      processed_count: result.totalSnapshots,
      error_message: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      duration_ms: durationMs,
      metadata: {
        projects: result.projectsProcessed,
        atRisk: result.totalAtRisk,
        errors: result.errors,
      },
    });

    return NextResponse.json({ ...result, durationMs });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMsg = err instanceof Error ? err.message : String(err);

    void logCronRun({
      job_name: 'forecast_refresh',
      status: 'failed',
      processed_count: 0,
      error_message: errorMsg,
      duration_ms: durationMs,
    });

    console.error('[Forecast Cron] Failed:', err);
    return NextResponse.json({ error: 'Forecast refresh failed' }, { status: 500 });
  }
}
