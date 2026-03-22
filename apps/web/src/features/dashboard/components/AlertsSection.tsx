'use client';

import { useState } from 'react';
import type { DashboardAlert } from '../types';
import { updateAlertNote } from '../services/updateAlertNote';

const REASON_LABELS: Record<string, string> = {
  no_heat: 'No Heat',
  prior_trade: 'Prior Trade',
  no_access: 'No Access',
  inspection: 'Inspection',
  plumbing: 'Plumbing',
  material: 'Material',
  moisture: 'Moisture',
  safety: 'Safety Clearance',
};

const CA_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-amber-400 border-amber-900/50 bg-amber-950/30' },
  acknowledged: { label: 'Ack', color: 'text-blue-400 border-blue-900/50 bg-blue-950/30' },
  in_progress: { label: 'In Progress', color: 'text-cyan-400 border-cyan-900/50 bg-cyan-950/30' },
  resolved: { label: 'Resolved', color: 'text-green-400 border-green-900/50 bg-green-950/30' },
};

type AlertsSectionProps = {
  alerts: DashboardAlert[];
};

/**
 * Section 2: "What needs my attention?"
 * Up to 5 alerts ranked by daily cost of inaction.
 * Click to expand: detail grid + action note editor.
 */
export function AlertsSection({ alerts }: AlertsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (alerts.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Alerts</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm text-zinc-500">No active delays. All areas on track.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Alerts</h2>
        <span className="text-xs text-red-400">{alerts.length} active</span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            isExpanded={expandedId === alert.id}
            onToggle={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  isExpanded,
  onToggle,
}: {
  alert: DashboardAlert;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ca = alert.correctiveActionStatus
    ? CA_STATUS_COLORS[alert.correctiveActionStatus]
    : null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Compact row (always visible) */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        {/* Left: location + trade + reason */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              F{alert.floor}
            </span>
            <span className="truncate text-sm font-medium text-zinc-200">{alert.tradeName}</span>
            <span className="text-xs text-zinc-500">{alert.areaName}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {REASON_LABELS[alert.reasonCode] ?? alert.reasonCode} — {alert.daysBlocked}d blocked
          </p>
        </div>

        {/* Center: cost */}
        <div className="px-4 text-right">
          <p className="text-sm font-bold text-red-400">
            ${alert.dailyCost.toLocaleString()}/day
          </p>
          <p className="text-[10px] text-zinc-500">
            ${alert.cumulativeCost.toLocaleString()} total
          </p>
        </div>

        {/* Right: CA status + chevron */}
        <div className="flex items-center gap-2">
          <div className="w-20 text-right">
            {ca ? (
              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ca.color}`}>
                {ca.label}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-600">No CA</span>
            )}
          </div>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
          {/* Detail grid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-zinc-500">Days Blocked</p>
              <p className="text-sm font-medium text-zinc-200">{alert.daysBlocked}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">Daily Cost</p>
              <p className="text-sm font-medium text-red-400">${alert.dailyCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">Total Cost</p>
              <p className="text-sm font-medium text-red-400">${alert.cumulativeCost.toLocaleString()}</p>
            </div>
          </div>

          {/* Action Note */}
          {alert.correctiveActionId ? (
            <NoteEditor
              correctiveActionId={alert.correctiveActionId}
              initialNote={alert.correctiveActionNote}
            />
          ) : (
            <p className="text-xs text-zinc-500 italic">
              No corrective action assigned yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NoteEditor({
  correctiveActionId,
  initialNote,
}: {
  correctiveActionId: string;
  initialNote: string | null;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const result = await updateAlertNote(correctiveActionId, note);
    setSaving(false);
    if (result.ok) setSaved(true);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Action Note
      </label>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="Add a note about the corrective action..."
        rows={2}
        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-700 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border border-amber-700 px-3 py-1 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-950/50 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Note'}
        </button>
        {saved && <span className="text-[10px] text-green-400">Saved</span>}
      </div>
    </div>
  );
}
