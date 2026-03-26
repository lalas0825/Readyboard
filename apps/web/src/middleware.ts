import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = [
  '/', '/login', '/signup', '/forgot-password',
  '/api/legal/verify', '/join', '/api/invite/redeem',
  '/api/billing/webhook', '/billing',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always allow
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // Dev bypass — skip auth check in development
  if (process.env.NODE_ENV === 'development') {
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

  // Role-based route protection (includes org_id for billing check)
  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  const gcRoles = ['gc_super', 'gc_pm', 'gc_admin', 'owner'];
  const subRoles = ['sub_pm', 'sub_super'];

  // GC dashboard — only GC roles
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard-sub')) {
    if (!profile || !gcRoles.includes(profile.role)) {
      // Sub users → redirect to sub dashboard
      if (profile && subRoles.includes(profile.role)) {
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
    if (!profile || !subRoles.includes(profile.role)) {
      // GC users → redirect to GC dashboard
      if (profile && gcRoles.includes(profile.role)) {
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
