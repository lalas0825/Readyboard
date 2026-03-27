'use client';

import { useState } from 'react';

type Props = {
  trialEndsAt: string | null;
  status: string;
};

/**
 * Dismissable trial countdown banner.
 * Only shows when ≤7 days remain. Red when ≤3 days.
 */
export function TrialBanner({ trialEndsAt, status }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (status !== 'trialing' || !trialEndsAt || dismissed) return null;

  const now = new Date();
  const ends = new Date(trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / 86400000));

  // Don't show if more than 7 days remain
  if (daysLeft > 7) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
        isUrgent
          ? 'border-red-800/50 bg-red-950/20 text-red-300'
          : 'border-amber-800/50 bg-amber-950/20 text-amber-300'
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        <span>{isUrgent ? '\u26A0\uFE0F' : '\u23F3'}</span>
        <span>
          {daysLeft === 0
            ? 'Your trial ends today.'
            : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your free trial.`}
        </span>
        <a
          href="/dashboard/billing"
          className={`ml-1 font-semibold underline ${
            isUrgent ? 'text-red-200 hover:text-red-100' : 'text-amber-200 hover:text-amber-100'
          }`}
        >
          Upgrade now
        </a>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
