'use client';

import type { DelayRow } from '../services/fetchDelayDetails';

type EvidenceModalProps = {
  delay: DelayRow;
  onClose: () => void;
};

/**
 * Modal showing GPS location and photo evidence for a delay.
 * GPS coordinates link to Google Maps. Photo displayed inline.
 */
export function EvidenceModal({ delay, onClose }: EvidenceModalProps) {
  const hasGps = delay.gpsLat != null && delay.gpsLng != null;
  const hasPhoto = !!delay.photoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            Evidence — {delay.areaName} / {delay.tradeName}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* GPS Section */}
          {hasGps && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">GPS Location</p>
              <div className="mt-2 flex items-center gap-3">
                <div>
                  <p className="font-mono text-xs text-zinc-300">
                    {delay.gpsLat!.toFixed(6)}, {delay.gpsLng!.toFixed(6)}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${delay.gpsLat},${delay.gpsLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto rounded border border-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:border-amber-700 hover:text-amber-400"
                >
                  Open in Maps
                </a>
              </div>
            </div>
          )}

          {/* Photo Section */}
          {hasPhoto && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Photo Evidence</p>
              <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={delay.photoUrl!}
                  alt={`Evidence for ${delay.areaName} ${delay.tradeName}`}
                  className="h-auto max-h-64 w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Delay Info */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Delay Details</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Floor:</span>
                <span className="ml-1 text-zinc-300">F{delay.floor}</span>
              </div>
              <div>
                <span className="text-zinc-500">Crew:</span>
                <span className="ml-1 text-zinc-300">{delay.crewSize} workers</span>
              </div>
              <div>
                <span className="text-zinc-500">Started:</span>
                <span className="ml-1 text-zinc-300">
                  {new Date(delay.startedAt).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Cost:</span>
                <span className="ml-1 font-semibold text-amber-400">
                  {delay.cumulativeCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            </div>
          </div>

          {!hasGps && !hasPhoto && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-6 text-center">
              <p className="text-xs text-zinc-500">No GPS or photo evidence available for this delay.</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Evidence is captured when foremen submit field reports via mobile.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
