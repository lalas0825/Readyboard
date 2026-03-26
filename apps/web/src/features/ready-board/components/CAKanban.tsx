'use client';

import { useState, useMemo } from 'react';
import { acknowledgeCA } from '../services/acknowledgeCA';
import { resolveCA } from '../services/resolveCA';
import { REASON_LABELS } from '@/lib/constants';
import { toast } from 'sonner';
import type { CAItem, CAPageData } from '../services/fetchCorrectiveActions';
import type { CorrectiveActionStatus } from '../types';

// ─── Types ──────────────────────────────────────────

type ViewMode = 'kanban' | 'table';

type Props = {
  data: CAPageData;
};

// ─── Column Config ──────────────────────────────────

const COLUMNS: { key: CorrectiveActionStatus; label: string; color: string; borderColor: string }[] = [
  { key: 'open', label: 'Open', color: 'text-red-400', borderColor: 'border-red-900/50' },
  { key: 'acknowledged', label: 'Acknowledged', color: 'text-amber-400', borderColor: 'border-amber-900/50' },
  { key: 'in_progress', label: 'In Progress', color: 'text-blue-400', borderColor: 'border-blue-900/50' },
  { key: 'resolved', label: 'Resolved', color: 'text-green-400', borderColor: 'border-green-900/50' },
];

// ─── Component ──────────────────────────────────────

export function CAKanban({ data }: Props) {
  const [items, setItems] = useState<CAItem[]>(data.items);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const metrics = data.metrics;

  const grouped = useMemo(() => {
    const map: Record<CorrectiveActionStatus, CAItem[]> = {
      open: [],
      acknowledged: [],
      in_progress: [],
      resolved: [],
    };
    for (const item of items) {
      map[item.status]?.push(item);
    }
    return map;
  }, [items]);

  const handleAcknowledge = async (id: string) => {
    setProcessingId(id);
    const result = await acknowledgeCA(id);
    if (result.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : i,
        ),
      );
      toast.success('Corrective action acknowledged.');
    } else {
      toast.error(result.error);
    }
    setProcessingId(null);
  };

  const handleResolve = async (id: string) => {
    setProcessingId(id);
    const result = await resolveCA(id);
    if (result.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'resolved' as const, resolvedAt: new Date().toISOString(), isOverdue: false } : i,
        ),
      );
      toast.success('Corrective action resolved. Linked delay closed.');
    } else {
      toast.error(result.error);
    }
    setProcessingId(null);
  };

  return (
    <div className="space-y-6">
      {/* ─── Metrics Bar ──────────────────────── */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <MiniMetric label="Total" value={metrics.total} />
        <MiniMetric label="Open" value={metrics.open} accent="red" />
        <MiniMetric label="Acknowledged" value={metrics.acknowledged} accent="amber" />
        <MiniMetric label="In Progress" value={metrics.inProgress} accent="blue" />
        <MiniMetric label="Resolved" value={metrics.resolved} accent="green" />
        <MiniMetric
          label="Avg Resolution"
          value={metrics.avgResolutionHours != null ? `${metrics.avgResolutionHours}h` : 'N/A'}
          accent="zinc"
        />
      </div>

      {/* Overdue alert */}
      {metrics.overdue > 0 && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3">
          <p className="text-xs font-semibold text-red-400">
            {metrics.overdue} overdue corrective action{metrics.overdue !== 1 ? 's' : ''}
          </p>
          <p className="mt-0.5 text-[10px] text-red-400/70">
            Past deadline without resolution. Escalation recommended.
          </p>
        </div>
      )}

      {/* ─── View Toggle ──────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('kanban')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'kanban' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Kanban
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'table' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Table
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
          <p className="text-sm text-zinc-400">No corrective actions yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Create corrective actions from the Ready Board grid when delays occur.
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ─── Kanban View ─────────────────────── */
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-lg border ${col.borderColor} bg-zinc-900/50 p-3`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className={`text-xs font-semibold ${col.color}`}>{col.label}</h3>
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                  {grouped[col.key].length}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[col.key].map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    processing={processingId === item.id}
                    onAcknowledge={handleAcknowledge}
                    onResolve={handleResolve}
                  />
                ))}
                {grouped[col.key].length === 0 && (
                  <p className="py-4 text-center text-[10px] text-zinc-600">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── Table View ──────────────────────── */
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-3 py-2.5 font-medium text-zinc-400">Area</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">Trade</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">Assigned To</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">Deadline</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400 text-right">Cost</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400 text-center">Status</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((item) => (
                <tr key={item.id} className={`transition-colors hover:bg-zinc-900/50 ${item.isOverdue ? 'bg-red-950/10' : ''}`}>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-400 mr-1.5">F{item.floor}</span>
                    <span className="text-zinc-200">{item.areaName}</span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-300">{item.tradeName}</td>
                  <td className="px-3 py-2.5 text-zinc-300">{item.assignedToName}</td>
                  <td className="px-3 py-2.5">
                    <span className={item.isOverdue ? 'text-red-400 font-medium' : 'text-zinc-400'}>
                      {new Date(item.deadline).toLocaleDateString()}
                    </span>
                    {item.isOverdue && <span className="ml-1 text-[10px] text-red-400">OVERDUE</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-400">
                    ${item.cumulativeCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ActionButtons
                      item={item}
                      processing={processingId === item.id}
                      onAcknowledge={handleAcknowledge}
                      onResolve={handleResolve}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Card ────────────────────────────────────

function KanbanCard({
  item,
  processing,
  onAcknowledge,
  onResolve,
}: {
  item: CAItem;
  processing: boolean;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  return (
    <div className={`rounded-lg border bg-zinc-900 p-2.5 ${item.isOverdue ? 'border-red-800/50' : 'border-zinc-800'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-200">
            {item.areaName}
          </p>
          <p className="text-[10px] text-zinc-500">
            {item.tradeName} — {REASON_LABELS[item.reasonCode] ?? item.reasonCode}
          </p>
        </div>
        {item.isOverdue && (
          <span className="shrink-0 rounded bg-red-950/50 px-1 py-0.5 text-[9px] font-bold text-red-400 border border-red-800/50">
            OVERDUE
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{item.assignedToName}</span>
        <span className="font-mono text-[10px] text-amber-400">
          ${item.cumulativeCost.toLocaleString()}
        </span>
      </div>

      <div className="mt-1 text-[10px] text-zinc-600">
        Due: {new Date(item.deadline).toLocaleDateString()}
      </div>

      {item.note && (
        <p className="mt-1.5 truncate text-[10px] text-zinc-500 italic">{item.note}</p>
      )}

      <div className="mt-2">
        <ActionButtons
          item={item}
          processing={processing}
          onAcknowledge={onAcknowledge}
          onResolve={onResolve}
        />
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────

function ActionButtons({
  item,
  processing,
  onAcknowledge,
  onResolve,
}: {
  item: CAItem;
  processing: boolean;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  if (item.status === 'resolved') return null;

  return (
    <div className="flex gap-1">
      {item.status === 'open' && (
        <button
          onClick={() => onAcknowledge(item.id)}
          disabled={processing}
          className="rounded border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-900/30 disabled:opacity-50"
        >
          {processing ? '...' : 'Acknowledge'}
        </button>
      )}
      {(item.status === 'acknowledged' || item.status === 'in_progress') && (
        <button
          onClick={() => onResolve(item.id)}
          disabled={processing}
          className="rounded border border-green-700/50 bg-green-950/30 px-2 py-0.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-900/30 disabled:opacity-50"
        >
          {processing ? '...' : 'Resolve'}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CorrectiveActionStatus }) {
  const styles = {
    open: 'border-red-800/50 bg-red-950/30 text-red-400',
    acknowledged: 'border-amber-800/50 bg-amber-950/30 text-amber-400',
    in_progress: 'border-blue-800/50 bg-blue-950/30 text-blue-400',
    resolved: 'border-green-800/50 bg-green-950/30 text-green-400',
  };

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase border ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function MiniMetric({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  const text = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    zinc: 'text-zinc-300',
  }[accent ?? 'zinc'] ?? 'text-zinc-300';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${text}`}>{value}</p>
    </div>
  );
}
