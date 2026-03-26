'use client';

import { useState } from 'react';
import { generateNodDraft } from '@/features/legal/services/nodAutoGen';
import { toast } from 'sonner';

type NodGenerateModalProps = {
  delayId: string;
  onClose: () => void;
};

/**
 * Modal to trigger NOD draft generation for a specific delay.
 * Calls the existing generateNodDraft server action (pending → draft).
 * If delay is already 'pending', it creates the draft PDF.
 * If no legal_status yet, it first flags it as pending, then creates draft.
 */
export function NodGenerateModal({ delayId, onClose }: NodGenerateModalProps) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateNodDraft(delayId);
      if (result.ok) {
        toast.success('NOD draft generated. Review it in the Overview tab.');
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to generate NOD draft.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Generate Notice of Delay</h3>
        <p className="mt-2 text-xs text-zinc-400">
          This will create a draft NOD for this delay. The draft includes delay details,
          cost calculations, and project information. You can review and sign it from the
          Overview page.
        </p>

        <div className="mt-1 rounded bg-zinc-800/50 px-3 py-2">
          <p className="text-[10px] text-zinc-500">
            Draft NOD = watermarked PDF. Final NOD requires GC signature.
          </p>
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Draft NOD'}
          </button>
        </div>
      </div>
    </div>
  );
}
