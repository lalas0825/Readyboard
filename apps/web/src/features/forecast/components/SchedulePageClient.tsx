'use client';

import { useState } from 'react';
import { ManualEntryTab } from './ManualEntryTab';
import { ScheduleUpload } from './ScheduleUpload';
import type { ScheduleItemRow } from '../types';
import type { ScheduleBaselineRow } from '../services/fetchScheduleBaselines';
import type { FloorTradeCell } from '../services/fetchFloorTradeMatrix';
import type { PlanId } from '@/lib/stripe';

type Tab = 'manual' | 'import';

type Props = {
  projectId: string;
  planId: PlanId;
  existingItems: ScheduleItemRow[];
  baselines: ScheduleBaselineRow[];
  matrix: FloorTradeCell[];
};

export function SchedulePageClient({
  projectId,
  planId,
  existingItems,
  baselines,
  matrix,
}: Props) {
  const [tab, setTab] = useState<Tab>('manual');

  return (
    <div className="space-y-6">
      {/* ─── Tab Toggle ──────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
        <button
          onClick={() => setTab('manual')}
          className={`rounded px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === 'manual'
              ? 'bg-amber-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          ✏️ Manual Entry
        </button>
        <button
          onClick={() => setTab('import')}
          className={`rounded px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === 'import'
              ? 'bg-amber-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          📁 CSV Import
        </button>
      </div>

      {/* ─── Tab Content ─────────────────────────── */}
      {tab === 'manual' ? (
        <ManualEntryTab
          projectId={projectId}
          matrix={matrix}
          baselines={baselines}
        />
      ) : (
        <ScheduleUpload
          projectId={projectId}
          planId={planId}
          existingItems={existingItems}
        />
      )}
    </div>
  );
}
