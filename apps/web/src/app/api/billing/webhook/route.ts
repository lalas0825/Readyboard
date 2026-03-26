import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';
import { writeAuditEntry } from '@/lib/audit';

/** Stripe SDK v20+ moved current_period_end to SubscriptionItem. */
function getPeriodEnd(sub: Stripe.Subscription): string | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler. No auth cookie — validated via signature.
 * Idempotent: UPSERT on stripe_subscription_id (UNIQUE constraint).
 *
 * Events handled:
 * - checkout.session.completed → create subscription record
 * - customer.subscription.updated → sync status/plan changes
 * - customer.subscription.deleted → mark canceled
 * - invoice.payment_failed → update status to past_due
 */
export async function POST(request: NextRequest) {
  const body = await request.text(); // RAW body for signature verification
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ['items.data'] },
        );

        const projectId = subscription.metadata.project_id;
        const orgId = subscription.metadata.org_id;
        const planId = subscription.metadata.plan_id ?? 'starter';

        if (!projectId || !orgId) {
          console.error('[Stripe Webhook] Missing metadata on subscription', subscription.id);
          break;
        }

        // UPSERT — idempotent for duplicate events
        await supabase.from('project_subscriptions').upsert(
          {
            org_id: orgId,
            project_id: projectId,
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            plan_id: planId,
            status: subscription.status,
            current_period_end: getPeriodEnd(subscription),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_subscription_id' },
        );

        // Ensure org has stripe_customer_id
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: subscription.customer as string })
          .eq('id', orgId);

        await writeAuditEntry({
          tableName: 'project_subscriptions',
          recordId: projectId,
          action: 'subscription_created',
          changedBy: projectId, // no user context in webhooks
          newValue: { plan_id: planId, status: subscription.status },
        });

        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;

        const { data: existing } = await supabase
          .from('project_subscriptions')
          .select('id, plan_id, status')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (!existing) break;

        const newPlanId = sub.metadata.plan_id ?? existing.plan_id;

        await supabase
          .from('project_subscriptions')
          .update({
            status: sub.status,
            plan_id: newPlanId,
            current_period_end: getPeriodEnd(sub),
            cancel_at: sub.cancel_at
              ? new Date(sub.cancel_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        await writeAuditEntry({
          tableName: 'project_subscriptions',
          recordId: existing.id,
          action: 'subscription_updated',
          changedBy: existing.id,
          oldValue: { plan_id: existing.plan_id, status: existing.status },
          newValue: { plan_id: newPlanId, status: sub.status },
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;

        await supabase
          .from('project_subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', deletedSub.id);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.parent?.subscription_details?.subscription;
        if (!subId || typeof subId !== 'string') break;

        const { data: existing } = await supabase
          .from('project_subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subId)
          .single();

        if (!existing) break;

        await supabase
          .from('project_subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId);

        await writeAuditEntry({
          tableName: 'project_subscriptions',
          recordId: existing.id,
          action: 'payment_failed',
          changedBy: existing.id,
          newValue: { invoice_id: invoice.id, status: 'past_due' },
        });

        break;
      }
    }
  } catch (err) {
    // Return 200 anyway — Stripe retries on 5xx, but these are internal errors.
    // Logging is sufficient; we don't want Stripe to keep retrying on DB issues.
    console.error('[Stripe Webhook] Handler error:', err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
