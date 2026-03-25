import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/getSession';
import { generateInviteLink } from '@/features/invites/services/generateInviteLink';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/invite/foreman
 * Creates a foreman invite with a link that includes the area_id.
 * Logs the SMS (no real SMS in V1).
 *
 * Body: { phone: string, areaId: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, areaId } = body;

    if (!phone || !areaId) {
      return NextResponse.json({ error: 'Missing phone or areaId' }, { status: 400 });
    }

    // Validate area exists and get its project
    const supabase = createServiceClient();
    const { data: area } = await supabase
      .from('areas')
      .select('id, name, project_id')
      .eq('id', areaId)
      .single();

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Generate invite link for foreman
    const result = await generateInviteLink({
      projectId: area.project_id,
      role: 'foreman',
      areaId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log SMS (no real SMS service in V1)
    console.log(`[SMS] Foreman invite to ${phone} for area "${area.name}": ${result.url}`);

    // Audit (fire-and-forget)
    await supabase.from('audit_log').insert({
      table_name: 'invite_tokens',
      action: 'foreman_invited',
      changed_by: session.user.id,
      record_id: areaId,
      new_value: { phone, areaName: area.name },
    });

    return NextResponse.json({
      ok: true,
      message: `Invite SMS logged for ${phone}`,
      url: result.url,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
