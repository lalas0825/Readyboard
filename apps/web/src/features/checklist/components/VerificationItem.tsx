'use client';

import type { VerificationQueueItem } from '../services/fetchVerificationQueue';

type Props = {
  item: VerificationQueueItem;
  onClick: () => void;
};

function formatWaitTime(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  }
  return `${Math.round(hours)}h`;
}

/**
 * Single verification queue row.
 * Color: red > 24h, amber > 4h, default otherwise.
 */
export function VerificationItem({ item, onClick }: Props) {
  const urgency =
    item.hoursWaiting > 24
      ? 'border-red-900/50 bg-red-950/20'
      : item.hoursWaiting > 4
        ? 'border-amber-900/50 bg-amber-950/20'
        : 'border-zinc-800 bg-zinc-900/50';

  const timeColor =
    item.hoursWaiting > 24
      ? 'text-red-400'
      : item.hoursWaiting > 4
        ? 'text-amber-400'
        : 'text-zinc-500';

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-zinc-800/50 ${urgency}`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-block rounded bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-300">
              {item.tradeType}
            </span>
            <span className="truncate text-sm font-medium text-zinc-200">
              {item.areaName}
            </span>
            <span className="text-xs text-zinc-500">Floor {item.floor}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
            <span>{Math.round(item.effectivePct)}% complete</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${timeColor}`}>
            {formatWaitTime(item.hoursWaiting)}
          </span>
          <span className="text-zinc-600">&rarr;</span>
        </div>
      </div>
    </button>
  );
}
