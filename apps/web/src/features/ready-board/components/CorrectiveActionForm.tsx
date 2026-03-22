'use client';

import { useState, useEffect, useId } from 'react';
import { fetchProjectUsers } from '../services/fetchProjectUsers';
import { createCorrectiveAction } from '../services/createCorrectiveAction';
import type { AssignableUser, CorrectiveActionData } from '../types';

type CorrectiveActionFormProps = {
  projectId: string;
  delayLogId: string;
  areaId: string;
  tradeName: string;
  /** Step 1: optimistic entry → wrench appears instantly */
  onOptimisticInsert: (action: CorrectiveActionData) => void;
  /** Step 2a: server confirmed → panel switches to READ_ONLY */
  onInsertSuccess: (tempId: string, action: CorrectiveActionData) => void;
  /** Step 2b: server failed → wrench disappears, error shown */
  onInsertRevert: (tempId: string, area_id: string, trade_name: string) => void;
};

/** Default deadline: today + 3 days (ISO date string) */
function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export function CorrectiveActionForm({
  projectId,
  delayLogId,
  areaId,
  tradeName,
  onOptimisticInsert,
  onInsertSuccess,
  onInsertRevert,
}: CorrectiveActionFormProps) {
  const reactId = useId();
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch assignable sub users on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchProjectUsers(projectId);
      if (cancelled) return;
      if (result.ok) {
        setUsers(result.data);
        if (result.data.length > 0) setAssignedTo(result.data[0].id);
      }
      setLoadingUsers(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const canSubmit = assignedTo && deadline && !isSubmitting && !loadingUsers;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    // Generate tempId for optimistic tracking
    const tempId = `temp-${reactId}-${Date.now()}`;

    // ── Step 1: Optimistic insert → wrench appears on GridCell immediately ──
    const optimisticAction: CorrectiveActionData = {
      id: tempId,
      delay_log_id: delayLogId,
      area_id: areaId,
      trade_name: tradeName,
      assigned_to: assignedTo,
      assigned_to_name: users.find((u) => u.id === assignedTo)?.name ?? 'Unknown',
      deadline,
      note: note || null,
      created_by: 'optimistic',
      created_at: new Date().toISOString(),
      status: 'open',
      isOptimistic: true,
    };
    onOptimisticInsert(optimisticAction);

    // ── Step 2: Server action ──
    const result = await createCorrectiveAction({
      delay_log_id: delayLogId,
      assigned_to: assignedTo,
      deadline,
      note,
    });

    setIsSubmitting(false);

    if (result.ok) {
      // ── Step 2a: Success → replace optimistic with real data ──
      onInsertSuccess(tempId, result.data);
    } else {
      // ── Step 2b: Failure → revert optimistic, show error ──
      onInsertRevert(tempId, areaId, tradeName);
      setError(result.error);
    }
  }

  // ── Loading state ──
  if (loadingUsers) {
    return <p className="text-xs text-zinc-500">Loading users...</p>;
  }

  // ── No users available ──
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
        <p className="text-xs text-zinc-400">No sub users found for this project.</p>
        <p className="mt-1 text-[10px] text-zinc-600">Assign a sub organization to the project first.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        New Corrective Action
      </h4>

      {/* Assigned To */}
      <div>
        <label className="mb-1 block text-[10px] font-medium text-zinc-500">Assign To</label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
      </div>

      {/* Deadline — auto-filled to today + 3 days */}
      <div>
        <label className="mb-1 block text-[10px] font-medium text-zinc-500">Deadline</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Note */}
      <div>
        <label className="mb-1 block text-[10px] font-medium text-zinc-500">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          disabled={isSubmitting}
          placeholder="Describe the corrective action..."
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Error toast */}
      {error && (
        <div className="rounded-md bg-red-950/40 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Submit — disabled during operation */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Corrective Action'}
      </button>
    </form>
  );
}
