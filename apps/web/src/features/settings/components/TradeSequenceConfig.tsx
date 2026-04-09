'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import {
  fetchTradeSequence,
  reorderTradeSequence,
  type TradeSequenceItem,
} from '../services/fetchTradeSequence';
import { deleteCustomTrade } from '../services/tradeSequenceActions';
import { updateTradeMode } from '../services/updateTradeMode';
import { ChecklistEditor } from './ChecklistEditor';
import { DuplicatePhaseModal } from './DuplicatePhaseModal';
import { AddTradeModal } from './AddTradeModal';

type Props = {
  projectId: string;
};

/**
 * TradeSequenceConfig — drag-to-reorder list of trades for a project.
 *
 * Replaces the previous static TradeConfig. Features:
 * - Drag handle (⠿) to reorder; persists via reorder_trade_sequence RPC
 * - Phase + Custom badges on the row
 * - Mode toggle (percentage / checklist)
 * - ⊕ Phase  → DuplicatePhaseModal
 * - ☐ Tasks  → ChecklistEditor (per-area-type; bathroom by default)
 * - ✕        → delete (only for is_custom rows)
 */
export function TradeSequenceConfig({ projectId }: Props) {
  const [trades, setTrades] = useState<TradeSequenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<TradeSequenceItem | null>(null);
  const [checklistTarget, setChecklistTarget] = useState<TradeSequenceItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await fetchTradeSequence(projectId);
    setTrades(rows);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const itemIds = useMemo(() => trades.map((t) => t.key), [trades]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = trades.findIndex((t) => t.key === active.id);
    const newIdx = trades.findIndex((t) => t.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(trades, oldIdx, newIdx);
    setTrades(reordered); // optimistic

    const result = await reorderTradeSequence(
      projectId,
      reordered.map((t) => ({ tradeName: t.tradeName, phaseLabel: t.phaseLabel })),
    );

    if (!result.ok) {
      toast.error(`Reorder failed: ${result.error}`);
      refresh();
    } else {
      toast.success('Trade order updated');
      // Refresh to pick up new sequence_order values from DB
      refresh();
    }
  }

  async function handleToggleMode(trade: TradeSequenceItem) {
    const newMode = trade.reportingMode === 'percentage' ? 'checklist' : 'percentage';
    setBusy(trade.key);
    const result = await updateTradeMode(projectId, trade.key, newMode);
    setBusy(null);

    if (result.ok) {
      toast.success(`${trade.tradeName} → ${newMode}`);
      refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(trade: TradeSequenceItem) {
    if (!trade.isCustom) return;
    const label = trade.phaseLabel
      ? `${trade.tradeName} (${trade.phaseLabel})`
      : trade.tradeName;
    if (!confirm(`Delete custom trade "${label}"?\n\nThis removes all tasks, status rows, and labor rates for this trade across every area. Completed work history is also deleted.`))
      return;

    setBusy(trade.key);
    const result = await deleteCustomTrade({
      projectId,
      tradeName: trade.tradeName,
      phaseLabel: trade.phaseLabel,
    });
    setBusy(null);

    if (result.ok) {
      toast.success('Trade deleted');
      refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Trade Sequence</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Drag to reorder. This defines column order in the Ready Board and which trade
            must complete before the next starts.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg border border-green-500/30 bg-green-500/20 px-3 py-1.5 text-sm font-medium text-green-400"
        >
          + Add Trade
        </button>
      </div>

      {/* Trade list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">
          Loading trade sequence…
        </div>
      ) : trades.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500">
          No trades configured. Click &quot;+ Add Trade&quot; to start.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {trades.map((trade, i) => (
                <SortableTradeRow
                  key={trade.key}
                  trade={trade}
                  index={i}
                  busy={busy === trade.key}
                  onDuplicate={() => setDuplicateSource(trade)}
                  onEditChecklist={() => setChecklistTarget(trade)}
                  onToggleMode={() => handleToggleMode(trade)}
                  onDelete={() => handleDelete(trade)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modals */}
      {showAdd && (
        <AddTradeModal
          projectId={projectId}
          trades={trades}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}

      {duplicateSource && (
        <DuplicatePhaseModal
          projectId={projectId}
          source={duplicateSource}
          trades={trades}
          onClose={() => setDuplicateSource(null)}
          onSuccess={() => {
            setDuplicateSource(null);
            refresh();
          }}
        />
      )}

      {checklistTarget && (
        <ChecklistEditor
          projectId={projectId}
          tradeName={checklistTarget.tradeName}
          tradeType={checklistTarget.key}
          phaseLabel={checklistTarget.phaseLabel}
          // Session 1 limitation: templates are per-area_type. Defaulting to 'bathroom'
          // keeps the editor functional for the common NYC interior-finish case.
          // Session 3 can add an area_type picker tab.
          areaType="bathroom"
          onClose={() => setChecklistTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableTradeRow
// ---------------------------------------------------------------------------

type RowProps = {
  trade: TradeSequenceItem;
  index: number;
  busy: boolean;
  onDuplicate: () => void;
  onEditChecklist: () => void;
  onToggleMode: () => void;
  onDelete: () => void;
};

function SortableTradeRow({
  trade,
  index,
  busy,
  onDuplicate,
  onEditChecklist,
  onToggleMode,
  onDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: trade.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const isChecklist = trade.reportingMode === 'checklist';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        isDragging
          ? 'border-amber-500/50 bg-zinc-800 shadow-lg'
          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⠿
      </div>

      {/* Sequence number */}
      <span className="w-6 text-right font-mono text-xs text-zinc-600">
        {index + 1}
      </span>

      {/* Trade info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-zinc-200">
          {trade.tradeName}
        </span>
        {trade.phaseLabel && (
          <span className="shrink-0 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
            {trade.phaseLabel}
          </span>
        )}
        {trade.isCustom && (
          <span className="shrink-0 rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
            Custom
          </span>
        )}
        <button
          onClick={onToggleMode}
          disabled={busy}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-30 ${
            isChecklist
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
          title="Toggle reporting mode"
        >
          {isChecklist ? 'CHECKLIST' : 'PERCENTAGE'}
        </button>

        {/* Task counts */}
        <div className="ml-1 flex shrink-0 gap-2 text-[10px] text-zinc-500">
          {trade.completedTaskCount > 0 && (
            <span className="text-green-500">{trade.completedTaskCount} done</span>
          )}
          {trade.activeTaskCount > 0 && (
            <span className="text-amber-400">{trade.activeTaskCount} active</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onDuplicate}
        className="shrink-0 px-2 text-xs text-zinc-500 hover:text-zinc-100"
        title="Add another phase"
      >
        ⊕ Phase
      </button>
      <button
        onClick={onEditChecklist}
        className="shrink-0 px-2 text-xs text-zinc-500 hover:text-zinc-100"
        title="Edit checklist"
      >
        ☐ Tasks
      </button>
      {trade.isCustom && (
        <button
          onClick={onDelete}
          disabled={busy}
          className="shrink-0 px-2 text-xs text-red-400/50 hover:text-red-400 disabled:opacity-30"
          title="Delete custom trade"
        >
          ✕
        </button>
      )}
    </div>
  );
}
