import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@readyboard/shared';

// ─── Types ───────────────────────────────────────────

export type SessionUser = {
  id: string;
  role: UserRole;
  org_id: string;
  name: string;
  email: string | null;
};

export type Session = {
  user: SessionUser;
  isDevBypass: boolean;
};

// ─── Session Resolution ──────────────────────────────

/**
 * Resolves the current user session.
 *
 * Wrapped in React cache() so auth.getUser() + users query run ONCE per
 * render, even if getSession() is called from both layout and page.tsx.
 * This eliminates the duplicate DB round-trip that previously happened on
 * every navigation (middleware calls getUser, then layout calls it again).
 *
 * - With real auth: reads Supabase session cookie → queries users table
 * - Dev bypass (NODE_ENV=development, no session): returns first gc_pm from seed data
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (user && !error) {
    const { data: profile } = await supabase
      .from('users')
      .select('id, role, org_id, name, email')
      .eq('id', user.id)
      .single();

    if (profile) {
      return {
        user: {
          id: profile.id,
          role: profile.role as UserRole,
          org_id: profile.org_id,
          name: profile.name,
          email: profile.email,
        },
        isDevBypass: false,
      };
    }
  }

  // ─── Dev Bypass ──────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    const { createServiceClient } = await import('@/lib/supabase/service');
    const service = createServiceClient();
    const { data: gcUser } = await service
      .from('users')
      .select('id, role, org_id, name, email')
      .eq('role', 'gc_pm')
      .limit(1)
      .single();

    if (gcUser) {
      return {
        user: {
          id: gcUser.id,
          role: gcUser.role as UserRole,
          org_id: gcUser.org_id,
          name: gcUser.name,
          email: gcUser.email,
        },
        isDevBypass: true,
      };
    }
  }

  return null;
});
