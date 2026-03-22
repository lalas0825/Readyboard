/**
 * Vitest stub for @/lib/supabase/client.
 * The real module imports @supabase/ssr which depends on browser APIs.
 * Tests that transitively import this module get a no-op stub instead.
 */
export function createClient() {
  throw new Error('Supabase client should not be called in tests — mock it per-test if needed');
}
