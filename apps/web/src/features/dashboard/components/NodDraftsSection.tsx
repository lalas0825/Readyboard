'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchNodDrafts } from '../services/fetchNodDrafts';
import { approveNodDraft } from '@/features/legal/services/nodAutoGen';
import { SignaturePad } from '@/features/legal/components/SignaturePad';
import type { NodDraftRow } from '../services/fetchNodDrafts';
import type { SignatureData } from '@/features/legal/components/SignaturePad';

const REASON_LABELS: Record<string, string> = {
  no_heat: 'No Heat',
  prior_trade: 'Prior Trade',
  no_access: 'No Access',
  inspection: 'Inspection',
  plumbing: 'Plumbing',
  material: 'Material',
  moisture: 'Moisture',
  safety: 'Safety',
};

type NodDraftsSectionProps = {
  projectId: string;
};

/**
 * Dashboard section: "Action Required: NOD Drafts"
 * Shows pending NOD drafts that require GC signature to finalize.
 * GC clicks "Approve & Sign" → SignaturePad → final PDF generated.
 */
export function NodDraftsSection({ projectId }: NodDraftsSectionProps) {
  const [drafts, setDrafts] = useState<NodDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    try {
      const data = await fetchNodDrafts(projectId);
      setDrafts(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleSign = async (delayLogId: string, sig: SignatureData) => {
    setProcessingId(delayLogId);
    try {
      const result = await approveNodDraft(delayLogId, {
        imageBase64: sig.imageBase64,
        metadata: sig.metadata,
      });
      if (result.ok) {
        setDrafts((prev) => prev.filter((d) => d.delayLogId !== delayLogId));
        setSigningId(null);
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return null;
  if (drafts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
          Action Required: NOD Drafts
        </h2>
        <span className="rounded-full bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-900/50">
          {drafts.length}
        </span>
      </div>

      <div className="space-y-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="rounded-lg border border-amber-900/30 bg-zinc-900/80 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-900/50">
                  F{draft.floor}
                </span>
                <div>
                  <span className="text-sm font-medium text-zinc-200">
                    {draft.areaName}
                  </span>
                  <span className="mx-1.5 text-zinc-600">·</span>
                  <span className="text-sm text-zinc-400">{draft.tradeName}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  {draft.hoursSinceCreation}h ago
                </span>
                <span className="text-sm font-semibold text-amber-400">
                  ${draft.cumulativeCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {REASON_LABELS[draft.reasonCode] ?? draft.reasonCode}
              </span>

              {draft.draftPdfPath && (
                <button
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
                  onClick={() => window.open(`/api/legal/draft-preview?path=${encodeURIComponent(draft.draftPdfPath!)}`, '_blank')}
                >
                  Review PDF
                </button>
              )}

              <button
                disabled={processingId === draft.delayLogId}
                onClick={() => setSigningId(draft.delayLogId)}
                className="ml-auto rounded border border-green-700 px-3 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-950/50 disabled:opacity-50"
              >
                {processingId === draft.delayLogId ? 'Processing...' : 'Approve & Sign'}
              </button>
            </div>

            {/* SignaturePad modal inline */}
            {signingId === draft.delayLogId && (
              <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 p-4">
                <p className="mb-3 text-xs text-zinc-400">
                  Sign below to authorize this Notice of Delay. This action is legally binding.
                </p>
                <SignaturePad
                  onSign={(sig) => handleSign(draft.delayLogId, sig)}
                  onCancel={() => setSigningId(null)}
                  disabled={processingId === draft.delayLogId}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
