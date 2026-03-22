'use client';

import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { createArea } from '../services/createArea';

const AREA_TYPES = [
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'lobby', label: 'Lobby' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'office', label: 'Office' },
];

type CreateAreaModalProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export function CreateAreaModal({ projectId, open, onClose, onCreated }: CreateAreaModalProps) {
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  const [areaType, setAreaType] = useState('bathroom');
  const [customAreaType, setCustomAreaType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = areaType === '__custom__';

  const resetForm = () => {
    setName('');
    setFloor('');
    setAreaType('bathroom');
    setCustomAreaType('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !floor.trim()) {
      setError('Name and floor are required.');
      return;
    }

    const resolvedType = isCustom ? customAreaType.trim().toLowerCase() : areaType;

    if (!resolvedType) {
      setError('Custom area type is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await createArea({
      projectId,
      name: name.trim(),
      floor: floor.trim(),
      areaType: resolvedType,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetForm();
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Area">
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Area Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bath 21A"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-700 focus:outline-none"
          />
        </div>

        {/* Floor */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Floor
          </label>
          <input
            type="text"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="e.g. 2"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-700 focus:outline-none"
          />
        </div>

        {/* Area Type */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Area Type
          </label>
          <select
            value={areaType}
            onChange={(e) => {
              setAreaType(e.target.value);
              if (e.target.value !== '__custom__') setCustomAreaType('');
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-amber-700 focus:outline-none"
          >
            {AREA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
            <option value="__custom__">Other (Custom)</option>
          </select>

          {isCustom && (
            <input
              type="text"
              value={customAreaType}
              onChange={(e) => setCustomAreaType(e.target.value)}
              placeholder="e.g. mechanical_room"
              className="mt-1.5 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-700 focus:outline-none"
            />
          )}
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
            {isSubmitting ? 'Creating...' : 'Create Area'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
