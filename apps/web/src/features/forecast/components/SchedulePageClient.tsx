'use client';

import { useState } from 'react';
import { ManualEntryTab } from './ManualEntryTab';
import { ScheduleUpload } from './ScheduleUpload';
import { GanttTimeline } from './GanttTimeline';
import type { ScheduleItemRow } from '../types';
import type { ScheduleBaselineRow } from '../services/fetchScheduleBaselines';
import type { FloorTradeCell } from '../services/fetchFloorTradeMatrix';
import type { GanttData } from '../services/fetchGanttData';
import type { PlanId } from '@/lib/stripe';

type Tab = 'manual' | 'import' | 'timeline';

type Props = {
  projectId: string;
  planId: PlanId;
  existingItems: ScheduleItemRow[];
  baselines: ScheduleBaselineRow[];
  matrix: FloorTradeCell[];
  gantt: GanttData;
  initialFloor?: string | null;
};

export function SchedulePageClient({
  projectId,
  planId,
  existingItems,
  baselines,
  matrix,
  gantt,
  initialFloor,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    gantt.rows.length > 0 && initialFloor ? 'timeline' : 'manual',
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'manual', label: '✏️ Manual Entry' },
    { key: 'import', label: '📁 CSV Import' },
    { key: 'timeline', label: '📅 Timeline' },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Tab Toggle ──────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-amber-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─────────────────────────── */}
      {tab === 'manual' && (
        <ManualEntryTab
          projectId={projectId}
          matrix={matrix}
          baselines={baselines}
        />
      )}
      {tab === 'import' && (
        <ScheduleUpload
          projectId={projectId}
          planId={planId}
          existingItems={existingItems}
        />
      )}
      {tab === 'timeline' && (
        <GanttTimeline
          rows={gantt.rows}
          dependencies={gantt.dependencies}
          tradeOrder={gantt.tradeOrder}
          initialFloor={initialFloor}
        />
      )}
    </div>
  );
}
