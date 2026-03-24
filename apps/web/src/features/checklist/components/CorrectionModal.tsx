'use client';

import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { requestCorrection } from '../services/requestCorrection';
import { toast } from 'sonner';

const CORRECTION_REASONS = [
  { value: 'workmanship', labelEn: 'Workmanship does not meet spec', labelEs: 'Trabajo no cumple especificaciones' },
  { value: 'wrong_material', labelEn: 'Wrong material installed', labelEs: 'Material incorrecto instalado' },
  { value: 'incomplete', labelEn: 'Missing items — incomplete', labelEs: 'Elementos faltantes — incompleto' },
  { value: 'failed_test', labelEn: 'Failed test — redo required', labelEs: 'Prueba fallida — rehacer requerido' },
  { value: 'safety', labelEn: 'Safety concern', labelEs: 'Preocupación de seguridad' },
  { value: 'other', labelEn: 'Other (see notes)', labelEs: 'Otro (ver notas)' },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  taskIds: string[];
  areaId: string;
  tradeType: string;
  onCorrected: () => void;
};

/**
 * Modal for GC to request corrections on selected tasks.
 * Reason dropdown + notes field. 'other' requires notes.
 * Calls gc_request_correction RPC atomically.
 */
export function CorrectionModal({ open, onClose, taskIds, areaId, tradeType, onCorrected }: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOtherWithoutNote = reason === 'other' && note.trim() === '';
  const canSubmit = reason !== '' && !isOtherWithoutNote && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);

    const result = await requestCorrection({
      taskIds,
      areaId,
      tradeType,
      reason,
      note: note.trim() || null,
    });

    setIsSubmitting(false);

    if (result.ok) {
      toast.success(`Correction requested — ${result.correctedCount} task(s) sent back`);
      setReason('');
      setNote('');
      onCorrected();
      onClose();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Request Correction — ${tradeType}`}>
      <div className="space-y-4">
        {/* Summary */}
        <p className="text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">{taskIds.length}</span> task(s) will be sent
          back for correction.
        </p>

        {/* Reason dropdown */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-600"
          >
            <option value="">Select reason...</option>
            {CORRECTION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.labelEn}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Notes{reason === 'other' && <span className="text-red-400"> *</span>}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={reason === 'other' ? 'Required for "Other" reason...' : 'Optional notes...'}
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-600"
          />
          {isOtherWithoutNote && (
            <p className="mt-1 text-xs text-red-400">Note is required when reason is &quot;Other&quot;</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? 'Sending...' : 'Request Correction'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
