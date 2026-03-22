/**
 * Vitest stub for @/lib/supabase/server.
 * The real module imports next/headers which is unavailable in vitest.
 * Tests that transitively import this module get a no-op stub instead.
 */
export async function createClient() {
  throw new Error('Supabase server client should not be called in tests — mock it per-test if needed');
}
