'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { stripe, PLAN_CONFIG, type PlanId } from '@/lib/stripe';

/**
 * Creates a Stripe Checkout session for a project subscription.
 * Returns the checkout URL for client redirect.
 *
 * Pattern: getSession() → resolve/create Stripe customer → create session
 */
export async function createCheckoutSession(input: {
  projectId: string;
  planId: PlanId;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const plan = PLAN_CONFIG[input.planId];
  if (!plan || !plan.priceId) return { ok: false, error: 'Invalid plan' };

  const supabase = createServiceClient();

  // 1. Resolve or create Stripe customer for the org
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, stripe_customer_id')
    .eq('id', session.user.org_id)
    .single();

  if (!org) return { ok: false, error: 'Organization not found' };

  let customerId = org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { org_id: org.id, created_by: session.user.id },
    });
    customerId = customer.id;

    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', org.id);
  }

  // 2. Get project name for checkout description
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', input.projectId)
    .single();

  // 3. Create Checkout Session
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?billing=success&project=${input.projectId}`,
    cancel_url: `${appUrl}/dashboard?billing=canceled`,
    subscription_data: {
      metadata: {
        project_id: input.projectId,
        org_id: session.user.org_id,
        plan_id: input.planId,
      },
    },
    metadata: {
      project_id: input.projectId,
      org_id: session.user.org_id,
      project_name: project?.name ?? 'ReadyBoard Project',
    },
    client_reference_id: input.projectId,
    allow_promotion_codes: true,
  });

  if (!checkoutSession.url) {
    return { ok: false, error: 'Failed to create checkout session' };
  }

  return { ok: true, url: checkoutSession.url };
}
