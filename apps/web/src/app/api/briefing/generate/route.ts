import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateMorningBriefing } from '@/lib/ai/generateBriefing';
import { logCronRun } from '@/lib/cronLogger';

/**
 * POST /api/briefing/generate
 *
 * Generates morning briefings for all eligible users.
 * Cron: daily at 11:00 UTC (6:00 AM ET).
 * Idempotent: generateMorningBriefing checks for existing briefing_date.
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
  const supabase = createServiceClient();

  try {
    // Get all GC/Sub PMs (briefing audience — never foremen)
    const { data: users } = await supabase
      .from('users')
      .select('id, role, language, org_id')
      .in('role', ['gc_pm', 'gc_admin', 'gc_super', 'sub_pm', 'superintendent', 'owner']);

    if (!users?.length) {
      void logCronRun({
        job_name: 'briefing_generate',
        status: 'success',
        processed_count: 0,
        duration_ms: Date.now() - startMs,
        metadata: { reason: 'No eligible users' },
      });
      return NextResponse.json({ generated: 0, reason: 'No eligible users' });
    }

    // Get all active projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, gc_org_id, sub_org_id');

    if (!projects?.length) {
      void logCronRun({
        job_name: 'briefing_generate',
        status: 'success',
        processed_count: 0,
        duration_ms: Date.now() - startMs,
        metadata: { reason: 'No projects' },
      });
      return NextResponse.json({ generated: 0, reason: 'No projects' });
    }

    let generated = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    // Generate briefing for each user × their accessible project
    for (const user of users) {
      const userProjects = projects.filter(
        (p) => p.gc_org_id === user.org_id || p.sub_org_id === user.org_id,
      );

      for (const project of userProjects) {
        try {
          const result = await generateMorningBriefing(
            user.id,
            project.id,
            user.role,
            user.language ?? 'en',
          );
          if (result.ok) generated++;
        } catch (err) {
          errors++;
          const msg = `user=${user.id}: ${err instanceof Error ? err.message : String(err)}`;
          errorMessages.push(msg);
          console.error(`[Briefing Cron] ${msg}`);
        }
      }
    }

    const durationMs = Date.now() - startMs;
    const status = errors > 0 ? (generated > 0 ? 'partial' : 'failed') : 'success';

    void logCronRun({
      job_name: 'briefing_generate',
      status,
      processed_count: generated,
      error_message: errorMessages.length > 0 ? errorMessages.slice(0, 5).join('; ') : undefined,
      duration_ms: durationMs,
      metadata: { users: users.length, generated, errors },
    });

    return NextResponse.json({ generated, errors, users: users.length, durationMs });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMsg = err instanceof Error ? err.message : String(err);

    void logCronRun({
      job_name: 'briefing_generate',
      status: 'failed',
      processed_count: 0,
      error_message: errorMsg,
      duration_ms: durationMs,
    });

    console.error('[Briefing Cron] Fatal:', err);
    return NextResponse.json({ error: 'Briefing generation failed' }, { status: 500 });
  }
}
