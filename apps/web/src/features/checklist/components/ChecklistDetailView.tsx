'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchTasksForVerification, type VerificationTask } from '../services/fetchTasksForVerification';
import { approveVerification } from '../services/approveVerification';
import { CorrectionModal } from './CorrectionModal';

type Props = {
  areaId: string;
  areaName: string;
  tradeType: string;
  onDone: () => void;
};

/**
 * Task list for GC to review before approving or requesting correction.
 * Shows all tasks, highlights completed SUB tasks and pending GC tasks.
 * Approve = all-or-nothing. Correction = select specific tasks.
 */
export function ChecklistDetailView({ areaId, areaName, tradeType, onDone }: Props) {
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);

  // Correction mode
  const [correctionMode, setCorrectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchTasksForVerification(areaId, tradeType);
    setTasks(result);
    setIsLoading(false);
  }, [areaId, tradeType]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleApprove() {
    setIsApproving(true);
    const result = await approveVerification(areaId, tradeType);
    setIsApproving(false);

    if (result.ok) {
      toast.success(`Verified — trade unblocked (${result.approvedCount} GC task(s) approved)`);
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  function toggleSelection(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  // Only completed SUB tasks can be selected for correction
  const selectableTasks = tasks.filter((t) => t.taskOwner === 'sub' && t.status === 'complete');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-500">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-xs text-zinc-500">
        {areaName} &middot; {tasks.length} tasks
      </div>

      {/* Task list */}
      <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const isComplete = task.status === 'complete';
          const isPending = task.status === 'pending';
          const isCorrection = task.status === 'correction_requested';
          const isNa = task.status === 'na';
          const isSelectable = correctionMode && task.taskOwner === 'sub' && isComplete;
          const isSelected = selectedIds.has(task.id);

          return (
            <div
              key={task.id}
              onClick={isSelectable ? () => toggleSelection(task.id) : undefined}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                isSelected
                  ? 'border-orange-700 bg-orange-950/30'
                  : isCorrection
                    ? 'border-orange-900/50 bg-orange-950/20'
                    : isNa
                      ? 'border-zinc-800/50 bg-zinc-900/30'
                      : 'border-zinc-800 bg-zinc-900/50'
              } ${isSelectable ? 'cursor-pointer hover:bg-zinc-800/50' : ''}`}
            >
              {/* Status icon */}
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {correctionMode && isSelectable ? (
                  <div
                    className={`h-4 w-4 rounded border ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-zinc-600'
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                ) : isComplete ? (
                  <span className="text-green-400">&#10003;</span>
                ) : isPending && task.taskOwner === 'gc' ? (
                  <span className="text-amber-400">&#9671;</span>
                ) : isCorrection ? (
                  <span className="text-orange-400">!</span>
                ) : isNa ? (
                  <span className="text-zinc-600">&mdash;</span>
                ) : (
                  <span className="text-zinc-600">&#9675;</span>
                )}
              </div>

              {/* Task info */}
              <div className="min-w-0 flex-1">
                <div className={`truncate ${isNa ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                  {task.taskNameEn}
                </div>
                {isCorrection && task.correctionReason && (
                  <div className="mt-0.5 text-xs text-orange-400">
                    Correction: {task.correctionReason}
                    {task.correctionNote && ` — ${task.correctionNote}`}
                  </div>
                )}
                {isComplete && task.completedAt && (
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Completed {new Date(task.completedAt).toLocaleDateString()}
                    {task.photoUrl && (
                      <span className="ml-2 text-blue-400">[photo]</span>
                    )}
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-shrink-0 items-center gap-1">
                {task.isGate && (
                  <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-300">
                    GATE
                  </span>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    task.taskOwner === 'gc'
                      ? 'bg-blue-900/40 text-blue-300'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {task.taskOwner.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Correction mode toggle */}
      {!correctionMode && selectableTasks.length > 0 && (
        <button
          onClick={() => setCorrectionMode(true)}
          className="text-xs text-orange-400 transition-colors hover:text-orange-300"
        >
          Select tasks for correction &rarr;
        </button>
      )}

      {correctionMode && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            {selectedIds.size} of {selectableTasks.length} selected
          </span>
          <button
            onClick={() => {
              setCorrectionMode(false);
              setSelectedIds(new Set());
            }}
            className="text-zinc-500 hover:text-zinc-300"
          >
            Cancel selection
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-zinc-800 pt-4">
        {correctionMode ? (
          <button
            onClick={() => setShowCorrectionModal(true)}
            disabled={selectedIds.size === 0}
            className="flex-1 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Request Correction ({selectedIds.size})
          </button>
        ) : (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isApproving ? 'Approving...' : 'Approve — Unblock Next Trade'}
          </button>
        )}
      </div>

      {/* Correction modal */}
      <CorrectionModal
        open={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        taskIds={Array.from(selectedIds)}
        areaId={areaId}
        tradeType={tradeType}
        onCorrected={() => {
          setCorrectionMode(false);
          setSelectedIds(new Set());
          onDone();
        }}
      />
    </div>
  );
}
