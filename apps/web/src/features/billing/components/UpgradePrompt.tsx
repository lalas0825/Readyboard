'use client';

import { useState } from 'react';
import { createCheckoutSession } from '../services/createCheckoutSession';
import { PLAN_CONFIG } from '@/lib/stripe';

type UpgradePromptProps = {
  projectId: string;
  feature: string;
  description?: string;
};

/**
 * Amber lock card shown when a Starter plan user tries to access a Pro feature.
 * Redirects to Stripe Checkout on click.
 */
export function UpgradePrompt({ projectId, feature, description }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    const result = await createCheckoutSession({ projectId, planId: 'pro' });
    if (result.ok) {
      window.location.href = result.url;
    }
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-950/50">
        <span className="text-2xl">&#128274;</span>
      </div>
      <h3 className="text-sm font-semibold text-amber-400">{feature}</h3>
      <p className="mt-1 text-xs text-zinc-400">
        {description ?? `This feature requires a Pro plan ($${PLAN_CONFIG.pro.price}/mo per project).`}
      </p>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="mt-4 rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? 'Redirecting...' : 'Upgrade to Pro'}
      </button>
    </div>
  );
}
