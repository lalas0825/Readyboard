'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getTradeChecklist,
  saveTradeChecklist,
  type TaskTemplateRow,
} from '../services/checklistActions';

type EditableTask = {
  id: string;
  task_name_en: string;
  task_name_es: string;
  task_owner: 'sub' | 'gc';
  is_gate: boolean;
  weight: number;
};

type Props = {
  projectId: string;
  tradeName: string;
  tradeType: string; // composite key for phases, plain trade_name otherwise
  phaseLabel?: string | null;
  areaType: string;
  onClose: () => void;
};

/**
 * ChecklistEditor — CRUD modal for trade checklists.
 *
 * Session 1 (this file): functional editor with up/down arrows for reordering.
 * Session 2 will upgrade reordering to drag-and-drop via dnd-kit.
 *
 * Completed tasks in existing areas are never deleted when a task is removed
 * from the checklist — they remain as historical evidence. Only pending tasks
 * are affected by checklist edits.
 */
export function ChecklistEditor({
  projectId,
  tradeName,
  tradeType,
  phaseLabel,
  areaType,
  onClose,
}: Props) {
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTradeChecklist(projectId, tradeType, areaType)
      .then((rows: TaskTemplateRow[]) => {
        if (cancelled) return;
        setTasks(
          rows.map((r) => ({
            id: r.id,
            task_name_en: r.task_name_en,
            task_name_es: r.task_name_es,
            task_owner: r.task_owner,
            is_gate: r.is_gate,
            weight: Number(r.weight),
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, tradeType, areaType]);

  function addTask() {
    const name = newTaskName.trim();
    if (!name) return;
    setTasks([
      ...tasks,
      {
        id: crypto.randomUUID(),
        task_name_en: name,
        task_name_es: '',
        task_owner: 'sub',
        is_gate: false,
        weight: 10,
      },
    ]);
    setNewTaskName('');
    setHasChanges(true);
  }

  function updateTask<K extends keyof EditableTask>(
    id: string,
    field: K,
    value: EditableTask[K],
  ) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    setHasChanges(true);
  }

  function deleteTask(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
    setHasChanges(true);
  }

  function moveTask(index: number, delta: -1 | 1) {
    const next = [...tasks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setTasks(next);
    setHasChanges(true);
  }

  async function handleSave() {
    setSaving(true);
    const result = await saveTradeChecklist({
      projectId,
      tradeType,
      areaType,
      tasks,
    });
    setSaving(false);

    if (result.ok) {
      toast.success(`Saved ${result.saved} tasks`);
      setHasChanges(false);
    } else {
      toast.error(result.error);
    }
  }

  function handleClose() {
    if (hasChanges && !confirm('Discard unsaved changes?')) return;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-800 bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-zinc-100">
              {tradeName}
              {phaseLabel && (
                <span className="ml-2 text-sm font-normal text-blue-400">
                  ({phaseLabel})
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500">
              {tasks.length} tasks · {areaType} · Gate tasks block next trade
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleClose}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900"
            >
              {hasChanges ? 'Discard' : 'Close'}
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-bold text-black disabled:opacity-30"
            >
              {saving ? 'Saving…' : 'Save Checklist'}
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500">
          <span className="w-10 text-center">Order</span>
          <span className="w-8 text-center">#</span>
          <span className="flex-1">Task name (EN)</span>
          <span className="w-24">Español</span>
          <span className="w-14 text-center">Weight</span>
          <span className="w-20 text-center">Owner</span>
          <span className="w-14 text-center">Gate</span>
          <span className="w-6"></span>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Loading checklist…
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No tasks yet. Add your first task below.
            </div>
          ) : (
            tasks.map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-2 border-b border-zinc-900 px-4 py-2 hover:bg-zinc-900/40"
              >
                {/* Reorder arrows */}
                <div className="flex w-10 flex-col items-center">
                  <button
                    onClick={() => moveTask(i, -1)}
                    disabled={i === 0}
                    className="text-xs text-zinc-500 hover:text-amber-400 disabled:opacity-20"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveTask(i, 1)}
                    disabled={i === tasks.length - 1}
                    className="text-xs text-zinc-500 hover:text-amber-400 disabled:opacity-20"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>

                {/* Index */}
                <span className="w-8 text-center font-mono text-xs text-zinc-600">
                  {i + 1}
                </span>

                {/* EN name */}
                <input
                  value={task.task_name_en}
                  onChange={(e) => updateTask(task.id, 'task_name_en', e.target.value)}
                  className="flex-1 border-b border-transparent bg-transparent text-sm text-zinc-200 outline-none focus:border-amber-500"
                />

                {/* ES name */}
                <input
                  value={task.task_name_es}
                  onChange={(e) => updateTask(task.id, 'task_name_es', e.target.value)}
                  placeholder="Español"
                  className="w-24 border-b border-transparent bg-transparent text-xs text-zinc-400 outline-none focus:border-amber-500"
                />

                {/* Weight */}
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={task.weight}
                  onChange={(e) =>
                    updateTask(task.id, 'weight', Number(e.target.value) || 0)
                  }
                  className="w-14 rounded border border-zinc-800 bg-transparent px-1 py-1 text-center text-xs text-zinc-300"
                />

                {/* Owner */}
                <button
                  onClick={() =>
                    updateTask(
                      task.id,
                      'task_owner',
                      task.task_owner === 'sub' ? 'gc' : 'sub',
                    )
                  }
                  className={`w-20 rounded-full px-2 py-1 text-[10px] font-bold ${
                    task.task_owner === 'gc'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {task.task_owner === 'gc' ? 'GC VERIFY' : 'SUB'}
                </button>

                {/* Gate */}
                <button
                  onClick={() => updateTask(task.id, 'is_gate', !task.is_gate)}
                  className={`w-14 rounded-full px-2 py-1 text-[10px] font-bold ${
                    task.is_gate
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-zinc-900 text-zinc-600'
                  }`}
                >
                  {task.is_gate ? 'GATE' : 'Gate'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="w-6 text-center text-sm text-red-400/40 hover:text-red-400"
                  aria-label="Delete task"
                >
                  ✕
                </button>
              </div>
            ))
          )}

          {/* Add task input */}
          <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-3">
            <span className="w-10"></span>
            <span className="w-8 text-center text-xs text-zinc-600">
              {tasks.length + 1}
            </span>
            <input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="New task name…"
              className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
            />
            <button
              onClick={addTask}
              disabled={!newTaskName.trim()}
              className="rounded bg-green-500/20 px-3 py-2 text-sm font-bold text-green-400 disabled:opacity-30"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Footer warning */}
        <div className="border-t border-zinc-800 p-3 text-[10px] text-zinc-500">
          Completed tasks in existing areas are never deleted when you remove a task from
          this checklist. Only pending (unchecked) tasks are affected by checklist changes.
        </div>
      </div>
    </div>
  );
}
