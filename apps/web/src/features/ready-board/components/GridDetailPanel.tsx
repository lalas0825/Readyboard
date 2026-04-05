'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { GridCellData, CorrectiveActionData, CorrectiveActionStatus, DelayData } from '../types';
import { STATUS_CONFIG } from '../types';
import { CorrectiveActionForm } from './CorrectiveActionForm';
import { StatusTimeline, type TimelineEvent } from './StatusTimeline';
import { useCellDetails } from '../hooks/useCellDetails';
import type { AreaTask } from '../services/fetchCellDetails';
import { toggleSafetyBlock } from '../services/toggleSafetyBlock';
import { acknowledgeCA } from '../services/acknowledgeCA';
import { resolveCA } from '../services/resolveCA';
import { addAreaNote } from '../services/addAreaNote';
import { REASON_LABELS } from '@/lib/constants';

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
  onActionUpdate?: () => void;
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

function ActionCard({ action, onUpdate }: { action: CorrectiveActionData; onUpdate?: () => void }) {
  const cfg = ACTION_STATUS_CONFIG[action.status];
  const [processing, setProcessing] = useState(false);

  const handleAcknowledge = async () => {
    setProcessing(true);
    const result = await acknowledgeCA(action.id);
    setProcessing(false);
    if (result.ok) {
      toast.success('Corrective Action acknowledged');
      onUpdate?.();
    } else {
      toast.error(result.error);
    }
  };

  const handleResolve = async () => {
    setProcessing(true);
    const result = await resolveCA(action.id);
    setProcessing(false);
    if (result.ok) {
      toast.success('Corrective Action resolved');
      onUpdate?.();
    } else {
      toast.error(result.error);
    }
  };

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

      {/* Lifecycle buttons */}
      {action.status === 'open' && (
        <button
          disabled={processing}
          onClick={handleAcknowledge}
          className="w-full rounded-md border border-blue-700 bg-blue-950/50 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-950 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Acknowledge'}
        </button>
      )}
      {action.status === 'acknowledged' && (
        <button
          disabled={processing}
          onClick={handleResolve}
          className="w-full rounded-md border border-green-700 bg-green-950/50 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-950 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Resolve'}
        </button>
      )}
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
  onActionUpdate,
}: GridDetailPanelProps) {
  const router = useRouter();
  const config = STATUS_CONFIG[cell.status];
  const panelState = derivePanelState(cell, existingAction);
  const [safetyToggling, setSafetyToggling] = useState(false);
  const [showCAForm, setShowCAForm] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const isSafetyBlocked = cell.delay_reason === 'safety';
  const isBlockedOrHeld = cell.status === 'blocked' || cell.status === 'held';

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  // Reset CA form when cell changes
  useEffect(() => {
    setShowCAForm(false);
    setLightboxUrl(null);
    setNewNote('');
  }, [cell.area_id, cell.trade_type]);

  // Lazy-load GPS, photos, report history, and notes
  const { data: details, isLoading: detailsLoading, refetch: refetchDetails } = useCellDetails(
    cell.area_id,
    cell.trade_type,
  );

  async function handleSendNote() {
    if (!newNote.trim() || sendingNote) return;
    setSendingNote(true);
    const { error } = await addAreaNote(cell.area_id, projectId, newNote.trim());
    setSendingNote(false);
    if (error) {
      toast.error(`Failed to send note: ${error}`);
    } else {
      setNewNote('');
      refetchDetails();
    }
  }

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
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">{cell.trade_type}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
              &times;
            </button>
          </div>
          {/* Area context */}
          <div className="mt-1 flex items-center gap-2 text-xs">
            {cell.area_code && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                {cell.area_code}
              </span>
            )}
            {cell.area_name && (
              <span className="text-zinc-300">{cell.area_name}</span>
            )}
            {cell.unit_name && (
              <span className="text-zinc-500">· Unit {cell.unit_name}</span>
            )}
          </div>
          {cell.area_description && (
            <p className="mt-0.5 text-[11px] text-zinc-500">{cell.area_description}</p>
          )}
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
                <ActionCard action={existingAction} onUpdate={onActionUpdate} />
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
              <div className="grid grid-cols-2 gap-2">
                {details.photos.map((photo, i) => (
                  <button
                    key={`${photo.created_at}-${i}`}
                    onClick={() => setLightboxUrl(photo.url)}
                    className="group relative block w-full rounded-md overflow-hidden bg-zinc-800 cursor-zoom-in"
                    style={{ height: '120px' }}
                  >
                    <img
                      src={photo.url}
                      alt={`Report photo ${i + 1}`}
                      className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                      <span className="text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded">Expand</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Photo Lightbox */}
          {lightboxUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
              onClick={closeLightbox}
            >
              <div className="relative max-w-4xl max-h-screen w-full p-4" onClick={(e) => e.stopPropagation()}>
                <img
                  src={lightboxUrl}
                  alt="Report evidence"
                  className="max-h-[85vh] w-full object-contain rounded-lg"
                />
                <button
                  onClick={closeLightbox}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold"
                >
                  ×
                </button>
                <a
                  href={lightboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-6 right-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open original ↗
                </a>
              </div>
            </div>
          )}

          {/* Checklist Tasks — Fix 1: Split sub/GC sections */}
          {details && details.tasks.length > 0 && (() => {
            const tasks: AreaTask[] = details.tasks;
            const subTasks = tasks.filter(t => t.task_owner === 'sub');
            const gcTasks = tasks.filter(t => t.task_owner === 'gc');
            const completedSubCount = subTasks.filter(t => t.status === 'complete').length;
            const totalSubCount = subTasks.length;
            const pendingGCTasks = gcTasks.filter(t => t.status !== 'complete');
            const subPct = totalSubCount > 0 ? Math.round((completedSubCount / totalSubCount) * 100) : 0;
            return (
              <div className="border-t border-zinc-800 pt-4 space-y-2">
                {/* Sub tasks header */}
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Sub Tasks ({completedSubCount}/{totalSubCount})
                  </h4>
                  <span className="text-xs text-zinc-500">{subPct}%</span>
                </div>
                {/* Sub progress bar */}
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${subPct}%`,
                      backgroundColor: completedSubCount === totalSubCount ? '#4ade80' : '#60a5fa',
                    }}
                  />
                </div>
                {/* Sub task list */}
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {subTasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2 px-1.5 py-1 rounded text-xs ${
                        task.status === 'complete' ? 'text-zinc-600' : 'text-zinc-300'
                      }`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                        task.status === 'complete'
                          ? 'bg-green-500/20 border-green-600 text-green-400'
                          : 'border-zinc-700'
                      }`}>
                        {task.status === 'complete' && '✓'}
                      </span>
                      <span className={`flex-1 leading-tight ${task.status === 'complete' ? 'line-through' : ''}`}>
                        {task.task_name_en}
                      </span>
                      {task.is_gate && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex-shrink-0">
                          GATE
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* GC Verification section */}
                {gcTasks.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-500">
                        GC Verification
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                    {gcTasks.map(task => {
                      const verified = task.status === 'complete';
                      return (
                        <div
                          key={task.id}
                          className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs ${
                            verified
                              ? 'bg-green-500/5 border border-green-900/40'
                              : 'bg-purple-500/5 border border-purple-900/40'
                          }`}
                        >
                          <span className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                            verified
                              ? 'bg-green-500/20 border-green-600 text-green-400'
                              : 'bg-purple-500/10 border-purple-600/60 border-dashed'
                          }`}>
                            {verified && '✓'}
                          </span>
                          <span className={`flex-1 leading-tight ${verified ? 'text-zinc-500 line-through' : 'text-purple-300'}`}>
                            {task.task_name_en}
                          </span>
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 ${
                            verified
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {verified ? 'DONE' : 'PENDING'}
                          </span>
                        </div>
                      );
                    })}
                    {/* GC VERIFY CTA */}
                    {pendingGCTasks.length > 0 && (
                      <button
                        onClick={() => router.push('/dashboard/verifications')}
                        className="mt-1 w-full py-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors"
                      >
                        {pendingGCTasks.length} verification{pendingGCTasks.length > 1 ? 's' : ''} pending →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Fix 2: Started / Completed dates */}
          {details && (details.startedAt || details.completedAt) && (
            <div className="border-t border-zinc-800 pt-4 space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Work Dates</h4>
              {details.startedAt && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Started</span>
                  <span className="text-zinc-300">{new Date(details.startedAt).toLocaleDateString()}</span>
                </div>
              )}
              {details.completedAt && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Completed</span>
                  <span className="text-green-400">{new Date(details.completedAt).toLocaleDateString()}</span>
                </div>
              )}
              {details.startedAt && details.completedAt && (() => {
                const days = Math.round(
                  (new Date(details.completedAt!).getTime() - new Date(details.startedAt!).getTime())
                  / (1000 * 60 * 60 * 24)
                );
                return (
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-zinc-300">{days} day{days !== 1 ? 's' : ''}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─── Area Notes ─── */}
          {details && (
            <div className="border-t border-zinc-800 pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Notes {details.notes.length > 0 && `(${details.notes.length})`}
              </h4>

              {details.notes.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {details.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-lg px-2.5 py-2 text-xs ${
                        note.is_system
                          ? 'text-zinc-500 italic'
                          : 'bg-white/5'
                      }`}
                    >
                      {!note.is_system && (
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-zinc-400">
                            {note.author_name} · {note.author_role}
                          </span>
                          <span className="text-zinc-600 text-[10px]">
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <p className="text-zinc-300 leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Note input */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendNote()}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSendNote}
                  disabled={!newNote.trim() || sendingNote}
                  className="rounded-lg border border-blue-700 bg-blue-950/50 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-950 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {sendingNote ? '…' : 'Send'}
                </button>
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
