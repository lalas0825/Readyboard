/**
 * useChecklist — PowerSync hook for checklist task CRUD.
 *
 * Reads area_tasks + area_trade_status from local SQLite.
 * Writes go to local DB instantly (optimistic), then sync to Supabase.
 * If RLS rejects (e.g., sub tries to complete gc task), PowerSync reverts.
 *
 * Zero-Logic UI rule: effective_pct comes from area_trade_status, never calculated here.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePowerSync } from './usePowerSync';

// ─── Types ───────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'complete' | 'blocked' | 'na' | 'correction_requested';

export type ChecklistTask = {
  id: string;
  area_id: string;
  trade_type: string;
  task_order: number;
  task_name_en: string;
  task_name_es: string;
  task_owner: 'sub' | 'gc';
  is_gate: boolean;
  weight: number;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  photo_url: string | null;
  notes: string | null;
  verification_requested_at: string | null;
  correction_reason: string | null;
  correction_note: string | null;
  correction_requested_at: string | null;
};

export type TradeProgress = {
  effective_pct: number;
  calculated_pct: number;
  all_gates_passed: boolean;
  gc_verification_pending: boolean;
};

// ─── Hook ────────────────────────────────────────────────────
export function useChecklist(areaId: string, tradeType: string) {
  const { db } = usePowerSync();
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [progress, setProgress] = useState<TradeProgress>({
    effective_pct: 0,
    calculated_pct: 0,
    all_gates_passed: false,
    gc_verification_pending: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!areaId || !tradeType) return;

    // Tasks for this area/trade, ordered by task_order
    const rawTasks = await db.getAll<Record<string, unknown>>(
      `SELECT id, area_id, trade_type, task_order, task_name_en, task_name_es,
              task_owner, is_gate, weight, status, completed_at, completed_by,
              photo_url, notes, verification_requested_at,
              correction_reason, correction_note, correction_requested_at
       FROM area_tasks
       WHERE area_id = ? AND trade_type = ?
       ORDER BY task_order`,
      [areaId, tradeType],
    );

    setTasks(
      rawTasks.map((r) => ({
        id: r.id as string,
        area_id: r.area_id as string,
        trade_type: r.trade_type as string,
        task_order: (r.task_order as number) ?? 0,
        task_name_en: (r.task_name_en as string) ?? '',
        task_name_es: (r.task_name_es as string) ?? '',
        task_owner: (r.task_owner as 'sub' | 'gc') ?? 'sub',
        is_gate: (r.is_gate as number) === 1,
        weight: (r.weight as number) ?? 0,
        status: (r.status as TaskStatus) ?? 'pending',
        completed_at: (r.completed_at as string) ?? null,
        completed_by: (r.completed_by as string) ?? null,
        photo_url: (r.photo_url as string) ?? null,
        notes: (r.notes as string) ?? null,
        verification_requested_at: (r.verification_requested_at as string) ?? null,
        correction_reason: (r.correction_reason as string) ?? null,
        correction_note: (r.correction_note as string) ?? null,
        correction_requested_at: (r.correction_requested_at as string) ?? null,
      })),
    );

    // Progress from area_trade_status (pre-calculated by DB trigger)
    const rawStatus = await db.getOptional<Record<string, unknown>>(
      `SELECT effective_pct, calculated_pct, all_gates_passed, gc_verification_pending
       FROM area_trade_status
       WHERE area_id = ? AND trade_type = ?`,
      [areaId, tradeType],
    );

    if (rawStatus) {
      setProgress({
        effective_pct: (rawStatus.effective_pct as number) ?? 0,
        calculated_pct: (rawStatus.calculated_pct as number) ?? 0,
        all_gates_passed: (rawStatus.all_gates_passed as number) === 1,
        gc_verification_pending: (rawStatus.gc_verification_pending as number) === 1,
      });
    }

    setIsLoading(false);
  }, [db, areaId, tradeType]);

  // Poll every 1s for responsive checklist updates
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /**
   * Toggle a task between pending and complete.
   * Writes directly to local PowerSync DB (instant).
   * Server-side trigger recalculates effective_pct.
   * If RLS rejects, PowerSync reverts automatically.
   */
  const toggleTask = useCallback(
    async (taskId: string, userId: string, userRole: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, error: 'Task not found' };

      // Guard: gate blocked by prior incomplete gate
      if (task.is_gate && task.status !== 'complete') {
        const priorGateIncomplete = tasks.some(
          (t) =>
            t.is_gate &&
            t.task_order < task.task_order &&
            t.status !== 'complete' &&
            t.status !== 'na',
        );
        if (priorGateIncomplete) {
          return { ok: false, error: 'gate_blocked' };
        }
      }

      const newStatus = task.status === 'complete' ? 'pending' : 'complete';
      const now = new Date().toISOString();

      // Optimistic: update local state immediately
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                completed_at: newStatus === 'complete' ? now : null,
                completed_by: newStatus === 'complete' ? userId : null,
              }
            : t,
        ),
      );

      try {
        // Write to PowerSync local DB
        await db.execute(
          `UPDATE area_tasks
           SET status = ?,
               completed_at = ?,
               completed_by = ?,
               completed_by_role = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            newStatus,
            newStatus === 'complete' ? now : null,
            newStatus === 'complete' ? userId : null,
            newStatus === 'complete' ? userRole : null,
            now,
            taskId,
          ],
        );

        return { ok: true };
      } catch (err) {
        // Revert optimistic update
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: task.status, completed_at: task.completed_at, completed_by: task.completed_by }
              : t,
          ),
        );
        return { ok: false, error: err instanceof Error ? err.message : 'Write failed' };
      }
    },
    [db, tasks],
  );

  /**
   * Re-submit a task that was sent back for correction.
   * Clears correction fields, resets status to 'complete'.
   * Server-side trigger will recalculate effective_pct and
   * re-set gc_verification_pending = true when all SUB tasks are done again.
   */
  const resubmitTask = useCallback(
    async (taskId: string, userId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status !== 'correction_requested') {
        return { ok: false, error: 'Task is not in correction_requested state' };
      }

      const now = new Date().toISOString();

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'complete' as TaskStatus,
                completed_at: now,
                completed_by: userId,
                correction_reason: null,
                correction_note: null,
                correction_requested_at: null,
              }
            : t,
        ),
      );

      try {
        await db.execute(
          `UPDATE area_tasks
           SET status = 'complete',
               completed_at = ?,
               completed_by = ?,
               completed_by_role = 'sub',
               correction_reason = NULL,
               correction_note = NULL,
               correction_requested_at = NULL,
               correction_requested_by = NULL,
               correction_resolved_at = ?,
               updated_at = ?
           WHERE id = ?`,
          [now, userId, now, now, taskId],
        );

        return { ok: true };
      } catch (err) {
        // Revert optimistic update
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: task.status,
                  completed_at: task.completed_at,
                  completed_by: task.completed_by,
                  correction_reason: task.correction_reason,
                  correction_note: task.correction_note,
                  correction_requested_at: task.correction_requested_at,
                }
              : t,
          ),
        );
        return { ok: false, error: err instanceof Error ? err.message : 'Re-submit failed' };
      }
    },
    [db, tasks],
  );

  return {
    tasks,
    progress,
    isLoading,
    toggleTask,
    resubmitTask,
    refresh: fetchData,
  };
}
