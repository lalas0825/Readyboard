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

  // Create Supabase server client for middleware
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

  // Role-based route protection (includes org_id for billing check)
  // Resilient: if query fails (schema cache, RLS), allow through (layout guards will catch)
  let profile: { role: string; org_id: string } | null = null;
  try {
    const { data } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single();
    profile = data;
  } catch {
    // Schema or RLS error — let through, layout-level guards will handle
    return response;
  }

  // If profile query returned null (user exists in auth but not in users table yet)
  if (!profile) return response;

  const gcRoles = ['gc_super', 'gc_pm', 'gc_admin', 'owner'];
  const subRoles = ['sub_pm', 'sub_super', 'superintendent'];

  // GC dashboard — only GC roles
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard-sub')) {
    if (!gcRoles.includes(profile.role)) {
      // Sub users → redirect to sub dashboard
      if (subRoles.includes(profile.role)) {
        return NextResponse.redirect(new URL('/dashboard-sub', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Past-due billing check — block GC admin features, NOT foreman operations
    if (profile.org_id) {
      const { data: pastDueSub } = await supabase
        .from('project_subscriptions')
        .select('status')
        .eq('org_id', profile.org_id)
        .eq('status', 'past_due')
        .limit(1)
        .maybeSingle();

      if (pastDueSub) {
        const url = new URL('/billing/payment-required', request.url);
        url.searchParams.set('from', pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  // Sub dashboard — only sub roles
  if (pathname.startsWith('/dashboard-sub')) {
    if (!subRoles.includes(profile.role)) {
      // GC users → redirect to GC dashboard
      if (gcRoles.includes(profile.role)) {
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
