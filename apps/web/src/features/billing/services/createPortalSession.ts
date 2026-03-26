'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { stripe } from '@/lib/stripe';

/**
 * Creates a Stripe Customer Portal session for billing management.
 * No custom card UI needed — Stripe handles everything.
 */
export async function createPortalSession(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', session.user.org_id)
    .single();

  if (!org?.stripe_customer_id) {
    return { ok: false, error: 'No billing account found. Subscribe to a plan first.' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl}/dashboard?tab=billing`,
  });

  return { ok: true, url: portalSession.url };
}
