'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/shared/components/Modal';
import { fetchVerificationQueue, type VerificationQueueItem } from '../services/fetchVerificationQueue';
import { VerificationItem } from './VerificationItem';
import { ChecklistDetailView } from './ChecklistDetailView';

type Props = {
  projectId: string;
  onCountChange?: (count: number) => void;
};

/**
 * GC Verification Queue — lists all area/trade pairs awaiting verification.
 * Click an item to open the detail view modal (approve or request correction).
 * Refreshes after every action.
 */
export function GCVerificationQueue({ projectId, onCountChange }: Props) {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<VerificationQueueItem | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchVerificationQueue(projectId);
    setItems(data);
    setIsLoading(false);
    onCountChange?.(data.length);
  }, [projectId, onCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleDone() {
    setSelected(null);
    refresh();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-500">Loading verification queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Pending Verifications</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-300">
            {items.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">All verifications are up to date</p>
          <p className="mt-1 text-xs text-zinc-600">
            When a sub completes all their tasks, verification items will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <VerificationItem
              key={`${item.areaId}-${item.tradeType}`}
              item={item}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal
          open={true}
          onClose={() => setSelected(null)}
          title={`${selected.tradeType} — ${selected.areaName}`}
        >
          <ChecklistDetailView
            areaId={selected.areaId}
            areaName={selected.areaName}
            tradeType={selected.tradeType}
            onDone={handleDone}
          />
        </Modal>
      )}
    </div>
  );
}
