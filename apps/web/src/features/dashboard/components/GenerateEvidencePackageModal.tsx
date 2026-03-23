'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/Modal';
import { SignaturePad } from '@/features/legal/components/SignaturePad';
import { fetchPreflightData } from '../services/fetchPreflightData';
import { generateEvidencePackage } from '@/features/legal/services/generateEvidencePackage';
import type { PreflightData } from '../services/fetchPreflightData';
import type { SignatureData } from '@/features/legal/components/SignaturePad';

type GenerateEvidencePackageModalProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
};

export function GenerateEvidencePackageModal({
  projectId,
  open,
  onClose,
  onGenerated,
}: GenerateEvidencePackageModalProps) {
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [locale, setLocale] = useState<'en' | 'es'>('en');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setShowSignature(false);
    setError(null);
    setDateStart('');
    setDateEnd('');

    fetchPreflightData(projectId).then((result) => {
      setPreflight(result);
      setIsLoading(false);
    });
  }, [open, projectId]);

  const hasData = preflight && (preflight.delayCount > 0 || preflight.nodCount > 0);

  const handleSign = async (sig: SignatureData) => {
    setIsGenerating(true);
    setError(null);

    const result = await generateEvidencePackage({
      projectId,
      signature: { imageBase64: sig.imageBase64, metadata: sig.metadata },
      locale,
      dateRangeStart: dateStart || undefined,
      dateRangeEnd: dateEnd || undefined,
    });

    setIsGenerating(false);

    if (result.ok) {
      toast.success('Evidence Package generated', {
        description: `SHA-256: ${result.hash.slice(0, 16)}...`,
      });
      onGenerated();
      onClose();
    } else {
      setError(result.error);
      setShowSignature(false);
      toast.error('Evidence Package generation failed');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate Evidence Package">
      <div className="space-y-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex h-32 items-center justify-center text-zinc-500 text-sm">
            Running pre-flight check...
          </div>
        )}

        {/* Pre-flight: no data */}
        {!isLoading && !hasData && (
          <div className="rounded-lg border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-400">No evidence to package</p>
            <p className="mt-1 text-xs text-zinc-600">
              You need at least one delay log or sent NOD to generate an evidence package.
            </p>
          </div>
        )}

        {/* Pre-flight summary + options */}
        {!isLoading && hasData && !showSignature && (
          <>
            {/* Data summary */}
            <div className="rounded-lg border border-blue-900/30 bg-blue-950/10 p-3">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Package Contents
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Stat label="Delays" value={preflight!.delayCount} />
                <Stat label="NODs Sent" value={preflight!.nodCount} />
                <Stat label="Field Reports" value={preflight!.fieldReportCount} />
                <Stat label="REAs" value={preflight!.reaCount} />
              </div>
            </div>

            {/* Date range filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Date Range (optional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                />
                <span className="text-xs text-zinc-600">to</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                />
              </div>
            </div>

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
                        ? 'bg-blue-950/50 text-blue-400 border border-blue-900/50'
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
                className="rounded-md border border-blue-700 bg-blue-950/50 px-4 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-950"
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
              Sign below to authorize this arbitration-ready Evidence Package.
              This action is legally binding.
            </p>
            <SignaturePad
              onSign={handleSign}
              onCancel={() => setShowSignature(false)}
              disabled={isGenerating}
            />
            {isGenerating && (
              <p className="text-center text-xs text-blue-400 animate-pulse">
                Generating Evidence Package PDF...
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-zinc-800/50 px-2 py-1.5">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}
