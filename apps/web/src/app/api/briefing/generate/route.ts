import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateMorningBriefing } from '@/lib/ai/generateBriefing';

/**
 * POST /api/briefing/generate
 *
 * Generates morning briefings for all eligible users.
 * Called by cron job (Vercel Cron or Supabase pg_cron) at 7:00 AM ET.
 *
 * Also callable manually for testing:
 *   curl -X POST http://localhost:3000/api/briefing/generate \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Security: requires CRON_SECRET header or service role.
 */
export async function POST(request: NextRequest) {
  // Auth: cron secret or skip in dev
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== 'development') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceClient();

  // Get all GC/Sub PMs (briefing audience — never foremen)
  const { data: users } = await supabase
    .from('users')
    .select('id, role, language, org_id')
    .in('role', ['gc_pm', 'gc_admin', 'gc_super', 'sub_pm', 'superintendent', 'owner']);

  if (!users?.length) {
    return NextResponse.json({ generated: 0, reason: 'No eligible users' });
  }

  // Get all active projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, gc_org_id, sub_org_id');

  if (!projects?.length) {
    return NextResponse.json({ generated: 0, reason: 'No projects' });
  }

  let generated = 0;
  let errors = 0;

  // Generate briefing for each user × their accessible project
  for (const user of users) {
    // Find projects this user can access
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
        console.error(`[Briefing Cron] Failed for user ${user.id}:`, err);
      }
    }
  }

  return NextResponse.json({ generated, errors, users: users.length });
}
