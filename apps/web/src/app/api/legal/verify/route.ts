import { NextRequest, NextResponse } from 'next/server';
import { verifyHash } from '@/lib/legal/verify';

/**
 * Public SHA-256 verification endpoint.
 *
 * GET /api/legal/verify?hash=[sha256_hash]
 *
 * No auth required — opposing counsel in arbitration must be able
 * to verify document integrity without a ReadyBoard account.
 */
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get('hash');

  if (!hash) {
    return NextResponse.json(
      { valid: false, reason: 'missing_hash_parameter' },
      { status: 400 }
    );
  }

  const result = await verifyHash(hash);

  if (!result.valid) {
    const status = result.reason === 'invalid_format' ? 400 : 404;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
