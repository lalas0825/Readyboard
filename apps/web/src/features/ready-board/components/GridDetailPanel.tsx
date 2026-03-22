'use client';

import { useState, useEffect } from 'react';
import type { GridCellData, CorrectiveActionData, CorrectiveActionStatus, DelayData } from '../types';
import { STATUS_CONFIG } from '../types';
import { CorrectiveActionForm } from './CorrectiveActionForm';
import { StatusTimeline, type TimelineEvent } from './StatusTimeline';
import { useCellDetails } from '../hooks/useCellDetails';
import { toggleSafetyBlock } from '../services/toggleSafetyBlock';

type GridDetailPanelProps = {
  cell: GridCellData;
  projectId: string;
  existingAction: CorrectiveActionData | null;
  delay: DelayData | null;
  safetyGateEnabled: boolean;
  onClose: () => void;
  onOptimisticInsert: (action: CorrectiveActionData) => void;
  onInsertSuccess: (tempId: string, action: CorrectiveActionData) => void;
  onInsertRevert: (tempId: string, area_id: string, trade_name: string) => void;
};

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

const ACTION_STATUS_CONFIG: Record<CorrectiveActionStatus, { label: string; color: string; bg: string; border: string }> = {
  open:         { label: 'Open',         color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-900/50' },
  acknowledged: { label: 'Acknowledged', color: 'text-blue-400',  bg: 'bg-blue-950/30',  border: 'border-blue-900/50' },
  in_progress:  { label: 'In Progress',  color: 'text-cyan-400',  bg: 'bg-cyan-950/30',  border: 'border-cyan-900/50' },
  resolved:     { label: 'Resolved',     color: 'text-green-400', bg: 'bg-green-950/30', border: 'border-green-900/50' },
};

// ─── Panel State Machine ──────────────────────────────
type PanelActionState = 'READ_ONLY' | 'FORM' | 'NO_DELAY' | null;

function derivePanelState(
  cell: GridCellData,
  action: CorrectiveActionData | null,
): PanelActionState {
  const isBlockedOrHeld = cell.status === 'blocked' || cell.status === 'held';
  if (!isBlockedOrHeld) return null;

  if (action && action.status !== 'resolved' && !action.isOptimistic) return 'READ_ONLY';
  if (cell.delay_log_id) return 'FORM';
  return 'NO_DELAY';
}

// ─── Action Card (read-only Ticket Unico) ─────────────

function ActionCard({ action }: { action: CorrectiveActionData }) {
  const cfg = ACTION_STATUS_CONFIG[action.status];
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Corrective Action
        </h4>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Assigned To</span>
          <span className="text-zinc-200">{action.assigned_to_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Deadline</span>
          <span className="text-zinc-200">{new Date(action.deadline).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Created</span>
          <span className="text-zinc-200">{new Date(action.created_at).toLocaleDateString()}</span>
        </div>
        {action.note && (
          <div className="pt-1">
            <span className="text-zinc-500">Note</span>
            <p className="mt-0.5 text-zinc-300">{action.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────

export function GridDetailPanel({
  cell,
  projectId,
  existingAction,
  delay,
  safetyGateEnabled,
  onClose,
  onOptimisticInsert,
  onInsertSuccess,
  onInsertRevert,
}: GridDetailPanelProps) {
  const config = STATUS_CONFIG[cell.status];
  const panelState = derivePanelState(cell, existingAction);
  const [safetyToggling, setSafetyToggling] = useState(false);
  const [showCAForm, setShowCAForm] = useState(false);
  const isSafetyBlocked = cell.delay_reason === 'safety';
  const isBlockedOrHeld = cell.status === 'blocked' || cell.status === 'held';

  // Reset CA form when cell changes
  useEffect(() => {
    setShowCAForm(false);
  }, [cell.area_id, cell.trade_type]);

  // Lazy-load GPS, photos, and report history
  const { data: details, isLoading: detailsLoading } = useCellDetails(
    cell.area_id,
    cell.trade_type,
  );

  // Build timeline events from report history
  const timelineEvents: TimelineEvent[] = (details?.reportHistory ?? []).map((r) => ({
    label: `${r.status} — ${r.progress_pct}%`,
    timestamp: r.created_at,
    color: STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]?.hex ?? '#71717a',
  }));

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="flex w-96 flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">{cell.trade_type}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-sm" style={{ backgroundColor: config.hex }} />
            <span className="text-sm font-medium text-zinc-200">
              {config.label} — {Math.round(cell.effective_pct)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(cell.effective_pct, 100)}%`,
                backgroundColor: config.hex,
              }}
            />
          </div>

          {/* Active delay info (enriched) */}
          {cell.has_alert && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 space-y-2">
              <p className="text-xs font-medium text-red-400">Active Delay</p>
              <p className="text-sm text-zinc-300">
                {cell.delay_reason ? REASON_LABELS[cell.delay_reason] ?? cell.delay_reason : 'Unknown reason'}
              </p>
              {cell.cost !== null && (
                <p className="text-lg font-bold text-red-400">
                  ${cell.cost.toLocaleString()}
                </p>
              )}
              {delay && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <p className="text-[10px] text-zinc-500">Daily Cost</p>
                    <p className="text-xs font-medium text-zinc-300">
                      ${delay.daily_cost.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Man Hours</p>
                    <p className="text-xs font-medium text-zinc-300">{delay.man_hours}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Crew Size</p>
                    <p className="text-xs font-medium text-zinc-300">{delay.crew_size}</p>
                  </div>
                </div>
              )}
              {delay?.started_at && (
                <p className="text-[10px] text-zinc-500">
                  Since {new Date(delay.started_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* GC Pending */}
          {cell.gc_pending && (
            <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 p-3">
              <p className="text-xs font-medium text-yellow-400">GC Verification Pending</p>
            </div>
          )}

          {/* Safety Clearance Gate */}
          {safetyGateEnabled && (
            <div className={`rounded-lg border p-3 ${
              isSafetyBlocked
                ? 'border-red-900/50 bg-red-950/30'
                : 'border-green-900/50 bg-green-950/30'
            }`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-medium ${isSafetyBlocked ? 'text-red-400' : 'text-green-400'}`}>
                  {isSafetyBlocked ? 'Safety Blocked' : 'Safety Cleared'}
                </p>
                <button
                  disabled={safetyToggling}
                  onClick={async () => {
                    setSafetyToggling(true);
                    await toggleSafetyBlock({
                      areaId: cell.area_id,
                      tradeName: cell.trade_type,
                    });
                    setSafetyToggling(false);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    isSafetyBlocked
                      ? 'border-green-700 text-green-400 hover:bg-green-950/50'
                      : 'border-red-700 text-red-400 hover:bg-red-950/50'
                  } disabled:opacity-50`}
                >
                  {safetyToggling ? '...' : isSafetyBlocked ? 'Clear Safety' : 'Block Safety'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Corrective Action Section (state machine) ─── */}
          {isBlockedOrHeld && (
            <div className="border-t border-zinc-800 pt-4">
              {panelState === 'READ_ONLY' && existingAction && (
                <ActionCard action={existingAction} />
              )}

              {panelState !== 'READ_ONLY' && !showCAForm && (
                <button
                  disabled={!cell.delay_log_id}
                  onClick={() => setShowCAForm(true)}
                  className="w-full rounded-md border border-amber-700 px-4 py-2.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-600 disabled:hover:bg-transparent"
                >
                  {cell.delay_log_id
                    ? 'Create Corrective Action'
                    : 'No active delay — CA unavailable'}
                </button>
              )}

              {panelState !== 'READ_ONLY' && showCAForm && cell.delay_log_id && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      New Corrective Action
                    </h4>
                    <button
                      onClick={() => setShowCAForm(false)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                  <CorrectiveActionForm
                    projectId={projectId}
                    delayLogId={cell.delay_log_id}
                    areaId={cell.area_id}
                    tradeName={cell.trade_type}
                    onOptimisticInsert={onOptimisticInsert}
                    onInsertSuccess={(tempId, action) => {
                      setShowCAForm(false);
                      onInsertSuccess(tempId, action);
                    }}
                    onInsertRevert={onInsertRevert}
                  />
                </div>
              )}
            </div>
          )}

          {/* ─── Lazy-loaded details ─── */}
          {detailsLoading && (
            <p className="text-xs text-zinc-500 animate-pulse">Loading details...</p>
          )}

          {/* GPS */}
          {details?.gps && (
            <div className="border-t border-zinc-800 pt-4 space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">GPS</h4>
              <p className="text-xs text-zinc-300">
                {details.gps.lat.toFixed(6)}, {details.gps.lng.toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${details.gps.lat},${details.gps.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[10px] text-amber-400 underline hover:text-amber-300"
              >
                Open in Google Maps
              </a>
            </div>
          )}

          {/* Photos */}
          {details && details.photos.length > 0 && (
            <div className="border-t border-zinc-800 pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Photos ({details.photos.length})
              </h4>
              <div className="grid grid-cols-4 gap-1.5">
                {details.photos.map((photo, i) => (
                  <a
                    key={`${photo.created_at}-${i}`}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-md bg-zinc-800"
                  >
                    <img
                      src={photo.url}
                      alt={`Report photo ${i + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status Timeline */}
          {timelineEvents.length > 0 && (
            <div className="border-t border-zinc-800 pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Report History
              </h4>
              <StatusTimeline events={timelineEvents} />
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2 text-xs text-zinc-500">
            <div className="flex justify-between">
              <span>Sequence</span>
              <span>Trade #{cell.sequence_order} of 14</span>
            </div>
            <div className="flex justify-between">
              <span>Gates</span>
              <span>{cell.gc_pending ? 'Pending' : 'Passed'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
