'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createCustomTrade } from '../services/tradeSequenceActions';
import type { TradeSequenceItem } from '../services/fetchTradeSequence';

type Props = {
  projectId: string;
  trades: TradeSequenceItem[];
  onClose: () => void;
  onSuccess: () => void;
};

/**
 * AddTradeModal — creates a brand-new custom trade not in the default 14-trade sequence.
 *
 * The checklist is empty at creation — the GC adds tasks afterwards via the
 * ChecklistEditor (☐ Tasks button on the row).
 */
export function AddTradeModal({ projectId, trades, onClose, onSuccess }: Props) {
  const [tradeName, setTradeName] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [description, setDescription] = useState('');
  const [insertAfter, setInsertAfter] = useState<number>(
    trades.length > 0 ? trades[trades.length - 1]!.sequenceOrder : 0,
  );
  const [reportingMode, setReportingMode] = useState<'percentage' | 'checklist'>(
    'percentage',
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const name = tradeName.trim();
    if (!name) return;

    setSaving(true);
    const result = await createCustomTrade({
      projectId,
      tradeName: name,
      phaseLabel: phaseLabel.trim() || undefined,
      description: description.trim() || undefined,
      insertAfterOrder: insertAfter,
      reportingMode,
    });
    setSaving(false);

    if (result.ok) {
      toast.success(`Trade "${name}" created`);
      onSuccess();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h3 className="mb-1 text-lg font-bold text-zinc-100">Add Custom Trade</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Create a trade not in the default sequence. You can add its checklist after
          creating via the ☐ Tasks button.
        </p>

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Trade name <span className="text-red-400">*</span>
        </label>
        <input
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          placeholder="e.g. Acoustic Insulation, Glass & Glazing"
          autoFocus
          className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Phase label (optional)
        </label>
        <input
          value={phaseLabel}
          onChange={(e) => setPhaseLabel(e.target.value)}
          placeholder="e.g. Phase 1 — Below Grade"
          className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Description (optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this trade cover?"
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
          <option value={0}>At the beginning</option>
          {trades.map((t) => (
            <option key={t.key} value={t.sequenceOrder}>
              {t.sequenceOrder}. {t.tradeName}
              {t.phaseLabel ? ` (${t.phaseLabel})` : ''}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Reporting mode
        </label>
        <div className="mb-6 flex gap-3">
          {(['percentage', 'checklist'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setReportingMode(mode)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm transition-colors ${
                reportingMode === mode
                  ? mode === 'checklist'
                    ? 'border-green-500 bg-green-500/20 text-green-300'
                    : 'border-amber-500 bg-amber-500/20 text-amber-300'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              {mode === 'percentage' ? 'Percentage (slider)' : 'Checklist (tasks)'}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!tradeName.trim() || saving}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-30"
          >
            {saving ? 'Creating…' : 'Create Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
