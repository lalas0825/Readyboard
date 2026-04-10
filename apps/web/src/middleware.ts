import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ─── Rate Limiting (in-memory, per-instance) ──────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > maxRequests;
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, 300000);
}

const PUBLIC_ROUTES = [
  '/', '/login', '/signup', '/forgot-password',
  '/api/legal/verify', '/join', '/api/invite/redeem',
  '/api/billing/webhook', '/api/briefing', '/api/push',
  '/billing', '/terms', '/privacy',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // ─── Rate limiting on sensitive routes ──────────
  if (pathname.startsWith('/api/billing/webhook')) {
    if (isRateLimited(`webhook:${clientIp}`, 100, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  } else if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/invite')) {
    if (isRateLimited(`auth-api:${clientIp}`, 10, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  } else if (
    pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password'
  ) {
    if (isRateLimited(`auth-page:${clientIp}`, 30, 60000)) {
      return NextResponse.redirect(new URL('/?error=rate_limit', request.url));
    }
  }

  // Public routes — always allow
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // Dev bypass — only when explicit flag is set (never in Vercel production)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true') {
    return NextResponse.next();
  }

  // Create Supabase server client for middleware (cookie refresh only)
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // auth.getUser() verifies the JWT locally — no extra DB round-trip.
  // role and org_id are read directly from app_metadata (set at signup/role change),
  // eliminating the previous users table query on every navigation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Email verification — block unverified users from protected routes
  if (!user.email_confirmed_at && pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/login?error=verify_email', request.url));
  }

  // Read role + org_id from JWT app_metadata — zero DB queries.
  // Falls back gracefully: if app_metadata is missing (pre-backfill session),
  // the layout guards will catch it on re-auth.
  const role = (user.app_metadata?.role as string) ?? '';
  const gcRoles = ['gc_super', 'gc_pm', 'gc_admin', 'owner'];
  const subRoles = ['sub_pm', 'sub_super', 'superintendent'];

  // GC dashboard — only GC roles
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard-sub')) {
    if (role && !gcRoles.includes(role)) {
      if (subRoles.includes(role)) {
        return NextResponse.redirect(new URL('/dashboard-sub', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Past-due billing check moved to layout.tsx — it already fetches
    // project_subscriptions for the trial banner, so we avoid a duplicate
    // DB query here on every navigation.
  }

  // Sub dashboard — only sub roles
  if (pathname.startsWith('/dashboard-sub')) {
    if (role && !subRoles.includes(role)) {
      if (gcRoles.includes(role)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.svg|.*\\.(?:svg|png|ico|jpg)$).*)'],
};
