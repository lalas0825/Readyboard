import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// 1x1 transparent PNG pixel (68 bytes)
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Tracking pixel endpoint for receipt acknowledgment.
 *
 * GET /api/legal/track/[uuid]
 *
 * When a GC opens a legal document email, the embedded <img> tag loads this
 * endpoint. We record the event and always return the pixel (no info leakage).
 *
 * Design:
 * - Uses service client (no auth — loaded by email client)
 * - Always returns the pixel regardless of UUID validity
 * - Cache-Control: no-store — forces re-fetch on every open
 * - Non-blocking: if DB write fails, pixel still returned
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;

  // Fire-and-forget: record the event without blocking the pixel response
  try {
    const supabase = createServiceClient();

    // 1. Find legal_document by receipt_tracking_uuid
    const { data: doc } = await supabase
      .from('legal_documents')
      .select('id, first_opened_at, open_count')
      .eq('receipt_tracking_uuid', uuid)
      .single();

    if (doc) {
      // 2. Insert receipt_event
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-real-ip')
        ?? null;
      const userAgent = request.headers.get('user-agent') ?? '';
      const deviceType = detectDeviceType(userAgent);

      await supabase.from('receipt_events').insert({
        document_id: doc.id,
        event_type: 'open',
        ip_address: ip,
        device_type: deviceType,
      });

      // 3. Update first_opened_at (if null) + increment open_count
      const updates: Record<string, unknown> = {
        open_count: (doc.open_count ?? 0) + 1,
      };
      if (!doc.first_opened_at) {
        updates.first_opened_at = new Date().toISOString();
      }

      await supabase
        .from('legal_documents')
        .update(updates)
        .eq('id', doc.id);
    }
  } catch {
    // Silent failure — always return the pixel
  }

  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(TRANSPARENT_PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

// ─── Helpers ────────────────────────────────────────

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
  if (ua.includes('outlook') || ua.includes('thunderbird') || ua.includes('mail')) return 'email_client';
  return 'desktop';
}
