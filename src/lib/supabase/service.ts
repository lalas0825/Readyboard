import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service role key.
 * ONLY for server-side use — bypasses RLS.
 *
 * Used for operations that need unrestricted access:
 * - SHA-256 hash verification (public endpoint)
 * - Cron jobs (forecast calculations)
 * - Edge functions
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. This client is only available server-side.'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
