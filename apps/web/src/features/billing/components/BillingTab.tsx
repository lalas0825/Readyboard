'use client';

import { useState } from 'react';
import { createPortalSession } from '../services/createPortalSession';
import { createCheckoutSession } from '../services/createCheckoutSession';
import { PLAN_CONFIG, type PlanId } from '@/lib/stripe';

type BillingTabProps = {
  projectId: string;
  currentPlan: PlanId;
  status: string;
  currentPeriodEnd: string | null;
};

export function BillingTab({ projectId, currentPlan, status, currentPeriodEnd }: BillingTabProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePortal = async () => {
    setLoading('portal');
    const result = await createPortalSession();
    if (result.ok) window.location.href = result.url;
    setLoading(null);
  };

  const handleUpgrade = async (planId: PlanId) => {
    setLoading(planId);
    const result = await createCheckoutSession({ projectId, planId });
    if (result.ok) window.location.href = result.url;
    setLoading(null);
  };

  const planConfig = PLAN_CONFIG[currentPlan];

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Billing &amp; Subscription
      </h2>

      {/* Current plan card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-200">{planConfig.label} Plan</p>
            <p className="text-xs text-zinc-500">${planConfig.price}/mo per project</p>
            {currentPeriodEnd && (
              <p className="text-[10px] text-zinc-600">
                Renews {new Date(currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              status === 'active'
                ? 'border border-green-900/50 bg-green-950/30 text-green-400'
                : status === 'past_due'
                  ? 'border border-red-900/50 bg-red-950/30 text-red-400'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-400'
            }`}
          >
            {status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {currentPlan !== 'starter' && (
          <button
            onClick={handlePortal}
            disabled={loading === 'portal'}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading === 'portal' ? 'Opening...' : 'Manage Billing'}
          </button>
        )}
        {currentPlan === 'starter' && (
          <button
            onClick={() => handleUpgrade('pro')}
            disabled={loading === 'pro'}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {loading === 'pro' ? 'Redirecting...' : `Upgrade to Pro — $${PLAN_CONFIG.pro.price}/mo`}
          </button>
        )}
      </div>

      {/* Feature comparison */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="mb-3 text-xs font-medium text-zinc-400">Plan Features</p>
        <div className="grid grid-cols-2 gap-4">
          {(['starter', 'pro'] as const).map((plan) => (
            <div key={plan} className={`rounded-lg p-3 ${plan === currentPlan ? 'border border-emerald-800/50 bg-emerald-950/10' : 'border border-zinc-800'}`}>
              <p className="text-xs font-semibold text-zinc-200">
                {PLAN_CONFIG[plan].label} — ${PLAN_CONFIG[plan].price}/mo
              </p>
              <ul className="mt-2 space-y-1">
                {PLAN_CONFIG[plan].features.map((f) => (
                  <li key={f} className="text-[10px] text-zinc-500">
                    {f.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
