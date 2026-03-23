'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/Modal';
import { SignaturePad } from '@/features/legal/components/SignaturePad';
import { fetchDelayLogsForRea } from '../services/fetchDelayLogsForRea';
import { generateRea } from '@/features/legal/services/generateRea';
import { REASON_LABELS } from '@/lib/constants';
import type { EligibleDelay } from '../services/fetchDelayLogsForRea';
import type { SignatureData } from '@/features/legal/components/SignaturePad';

const OVERHEAD_MULTIPLIER = 1.15;

type GenerateReaModalProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
};

export function GenerateReaModal({ projectId, open, onClose, onGenerated }: GenerateReaModalProps) {
  const [delays, setDelays] = useState<EligibleDelay[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [locale, setLocale] = useState<'en' | 'es'>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setSelectedIds(new Set());
    setShowSignature(false);
    setError(null);

    fetchDelayLogsForRea(projectId).then((result) => {
      setDelays(result);
      setIsLoading(false);
    });
  }, [open, projectId]);

  const toggleDelay = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === delays.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(delays.map((d) => d.id)));
    }
  };

  const selectedDelays = delays.filter((d) => selectedIds.has(d.id));
  const subtotal = selectedDelays.reduce((sum, d) => sum + d.cumulativeCost, 0);
  const totalWithOverhead = subtotal * OVERHEAD_MULTIPLIER;

  const handleSign = async (sig: SignatureData) => {
    setIsGenerating(true);
    setError(null);

    const result = await generateRea({
      projectId,
      delayLogIds: Array.from(selectedIds),
      signature: { imageBase64: sig.imageBase64, metadata: sig.metadata },
      locale,
      overheadMultiplier: OVERHEAD_MULTIPLIER,
    });

    setIsGenerating(false);

    if (result.ok) {
      toast.success(`REA generated — ${formatCurrency(result.totalClaim)}`, {
        description: `SHA-256: ${result.hash.slice(0, 16)}...`,
      });
      onGenerated();
      onClose();
    } else {
      setError(result.error);
      setShowSignature(false);
      toast.error('REA generation failed');
    }
  };

  const canProceed = selectedIds.size > 0;

  return (
    <Modal open={open} onClose={onClose} title="Generate REA">
      <div className="space-y-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex h-32 items-center justify-center text-zinc-500 text-sm">
            Loading eligible delays...
          </div>
        )}

        {/* Pre-flight: no eligible delays */}
        {!isLoading && delays.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-400">No delays eligible for REA</p>
            <p className="mt-1 text-xs text-zinc-600">
              Delays must have a sent NOD and no existing REA link.
            </p>
          </div>
        )}

        {/* Delay selection */}
        {!isLoading && delays.length > 0 && !showSignature && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Select Delays ({selectedIds.size}/{delays.length})
              </label>
              <button
                onClick={selectAll}
                className="text-[10px] text-amber-400 hover:text-amber-300"
              >
                {selectedIds.size === delays.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {delays.map((delay) => {
                const isSelected = selectedIds.has(delay.id);
                return (
                  <button
                    key={delay.id}
                    onClick={() => toggleDelay(delay.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-amber-900/50 bg-amber-950/20'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-sm border ${
                          isSelected ? 'border-amber-500 bg-amber-500' : 'border-zinc-600'
                        }`} />
                        <span className="text-sm text-zinc-200">{delay.areaName}</span>
                        <span className="text-xs text-zinc-500">{delay.tradeName}</span>
                      </div>
                      <span className="text-sm font-semibold text-amber-400">
                        {formatCurrency(delay.cumulativeCost)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-5">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {REASON_LABELS[delay.reasonCode] ?? delay.reasonCode}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {delay.manHours}h · {new Date(delay.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Running total */}
            {canProceed && (
              <div className="rounded-lg border border-amber-900/30 bg-amber-950/10 p-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Subtotal ({selectedIds.size} delays)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Overhead (15%)</span>
                  <span>{formatCurrency(subtotal * 0.15)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-amber-900/30 pt-1">
                  <span className="text-sm font-semibold text-amber-400">Total Claim</span>
                  <span className="text-sm font-semibold text-amber-400">
                    {formatCurrency(totalWithOverhead)}
                  </span>
                </div>
              </div>
            )}

            {/* Locale toggle */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Language
              </label>
              <div className="flex gap-1">
                {(['en', 'es'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      locale === l
                        ? 'bg-amber-950/50 text-amber-400 border border-amber-900/50'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSignature(true)}
                disabled={!canProceed}
                className="rounded-md border border-amber-700 bg-amber-950/50 px-4 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-950 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canProceed ? 'Select at least one delay' : undefined}
              >
                Continue to Sign
              </button>
            </div>
          </>
        )}

        {/* Signature step */}
        {showSignature && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              Sign below to authorize this Request for Equitable Adjustment
              for <span className="font-semibold text-amber-400">{formatCurrency(totalWithOverhead)}</span>.
              This action is legally binding.
            </p>
            <SignaturePad
              onSign={handleSign}
              onCancel={() => setShowSignature(false)}
              disabled={isGenerating}
            />
            {isGenerating && (
              <p className="text-center text-xs text-amber-400 animate-pulse">
                Generating REA PDF...
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
