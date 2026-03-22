'use client';

import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { createLegalDoc } from '../services/createLegalDoc';
import type { LegalDoc, LegalDocType } from '../types';

const DOC_TYPES: { value: LegalDocType; label: string; description: string; color: string; bg: string; border: string }[] = [
  {
    value: 'nod',
    label: 'NOD',
    description: 'Notice of Delay — documents a blocked area',
    color: 'text-purple-400',
    bg: 'bg-purple-950/30',
    border: 'border-purple-900/50',
  },
  {
    value: 'rea',
    label: 'REA',
    description: 'Request for Equitable Adjustment — cost claim',
    color: 'text-amber-400',
    bg: 'bg-amber-950/30',
    border: 'border-amber-900/50',
  },
  {
    value: 'evidence',
    label: 'Evidence',
    description: 'Evidence Package — arbitration-ready PDF',
    color: 'text-blue-400',
    bg: 'bg-blue-950/30',
    border: 'border-blue-900/50',
  },
];

type CreateDocModalProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (doc: LegalDoc) => void;
};

export function CreateDocModal({ projectId, open, onClose, onCreated }: CreateDocModalProps) {
  const [selectedType, setSelectedType] = useState<LegalDocType>('nod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await createLegalDoc({ projectId, type: selectedType });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const newDoc: LegalDoc = {
      id: result.docId,
      type: selectedType,
      sha256Hash: null,
      publishedToGc: false,
      publishedAt: null,
      sentAt: null,
      pdfUrl: null,
      openCount: 0,
      createdAt: result.createdAt,
    };

    onCreated(newDoc);
    setSelectedType('nod');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate New Document">
      <div className="space-y-4">
        {/* Type selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Document Type
          </label>
          <div className="space-y-2">
            {DOC_TYPES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => setSelectedType(dt.value)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedType === dt.value
                    ? `${dt.border} ${dt.bg} ring-1 ring-offset-0 ring-offset-zinc-900`
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                }`}
                style={
                  selectedType === dt.value
                    ? { ['--tw-ring-color' as string]: dt.border.replace('border-', '').replace('/50', '') }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${dt.color}`}>{dt.label}</span>
                  {selectedType === dt.value && (
                    <span className={`text-[10px] ${dt.color}`}>Selected</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{dt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md border border-amber-700 bg-amber-950/50 px-4 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-950 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Draft'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
