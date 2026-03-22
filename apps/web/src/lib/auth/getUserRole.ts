import { getSession } from './getSession';
import type { UserRole } from '@readyboard/shared';

const GC_ROLES: UserRole[] = ['gc_super', 'gc_pm', 'gc_admin', 'owner'];

/** Quick role check — returns null if no session */
export async function getUserRole(): Promise<UserRole | null> {
  const session = await getSession();
  return session?.user.role ?? null;
}

/** Throws if user is not a GC role. Use in server components/actions that require GC access. */
export async function requireGCRole(): Promise<{ id: string; role: UserRole; org_id: string }> {
  const session = await getSession();
  if (!session || !GC_ROLES.includes(session.user.role)) {
    throw new Error('Unauthorized: GC role required');
  }
  return session.user;
}

export function isGCRole(role: UserRole): boolean {
  return GC_ROLES.includes(role);
}
