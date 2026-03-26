import Stripe from 'stripe';

/**
 * Singleton Stripe client. Server-only.
 * Used by server actions and the webhook handler.
 *
 * In development, allows empty key (billing features gracefully degrade).
 * In production, throws immediately if STRIPE_SECRET_KEY is missing.
 */
const key = process.env.STRIPE_SECRET_KEY;
if (!key && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(key || 'sk_test_placeholder', {
  typescript: true,
});

/**
 * Plan metadata mapping.
 * Price IDs come from Stripe Dashboard — loaded via env vars
 * so they differ between test/live mode.
 */
export const PLAN_CONFIG = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    label: 'Starter',
    price: 399,
    features: ['readiness_grid', 'forecast', 'delay_logs'] as string[],
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    label: 'Pro',
    price: 699,
    features: [
      'readiness_grid', 'forecast', 'delay_logs',
      'legal_docs', 'sha256', 'receipt_tracking', 'checklist_mode',
    ] as string[],
  },
  portfolio: {
    priceId: process.env.STRIPE_PRICE_PORTFOLIO ?? '',
    label: 'Portfolio',
    price: 1999,
    features: [
      'readiness_grid', 'forecast', 'delay_logs',
      'legal_docs', 'sha256', 'receipt_tracking', 'checklist_mode',
      'multi_project', 'api', 'ai_insights',
    ] as string[],
  },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

/** Pro-only features that require plan gating. */
export const PRO_FEATURES = [
  'legal_docs', 'sha256', 'receipt_tracking', 'checklist_mode',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];
