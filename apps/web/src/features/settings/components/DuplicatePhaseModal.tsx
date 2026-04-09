'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { duplicateTradeAsPhase } from '../services/tradeSequenceActions';
import type { TradeSequenceItem } from '../services/fetchTradeSequence';

type Props = {
  projectId: string;
  source: TradeSequenceItem;
  trades: TradeSequenceItem[];
  onClose: () => void;
  onSuccess: () => void;
};

/**
 * DuplicatePhaseModal — creates a new phase of an existing trade.
 *
 * The new phase appears as a separate column in the Ready Board with its own progress
 * tracking. The composite trade_type key becomes "{trade_name}::{phase_label}".
 */
export function DuplicatePhaseModal({
  projectId,
  source,
  trades,
  onClose,
  onSuccess,
}: Props) {
  const [phaseLabel, setPhaseLabel] = useState('');
  const [description, setDescription] = useState('');
  const [insertAfter, setInsertAfter] = useState<number>(source.sequenceOrder);
  const [copyChecklist, setCopyChecklist] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const label = phaseLabel.trim();
    if (!label) return;

    setSaving(true);
    const result = await duplicateTradeAsPhase({
      projectId,
      sourceTradeName: source.tradeName,
      phaseLabel: label,
      description: description.trim() || undefined,
      insertAfterOrder: insertAfter,
      copyChecklist,
    });
    setSaving(false);

    if (result.ok) {
      toast.success(`Phase "${label}" created`);
      onSuccess();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h3 className="mb-1 text-lg font-bold text-zinc-100">
          Add Phase: {source.tradeName}
        </h3>
        <p className="mb-4 text-xs text-zinc-500">
          Creates a new phase. It appears as a separate column in the Ready Board with its
          own progress tracking.
        </p>

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Phase name <span className="text-red-400">*</span>
        </label>
        <input
          value={phaseLabel}
          onChange={(e) => setPhaseLabel(e.target.value)}
          placeholder="Phase 2 — Interior Partitions"
          autoFocus
          className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Description (optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Second pass framing after MEP rough-in"
          className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Insert after
        </label>
        <select
          value={insertAfter}
          onChange={(e) => setInsertAfter(Number(e.target.value))}
          className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          {trades.map((t) => (
            <option key={t.key} value={t.sequenceOrder}>
              {t.sequenceOrder}. {t.tradeName}
              {t.phaseLabel ? ` (${t.phaseLabel})` : ''}
            </option>
          ))}
        </select>

        <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={copyChecklist}
            onChange={(e) => setCopyChecklist(e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          Copy checklist from original phase
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!phaseLabel.trim() || saving}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-30"
          >
            {saving ? 'Creating…' : 'Create Phase'}
          </button>
        </div>
      </div>
    </div>
  );
}
