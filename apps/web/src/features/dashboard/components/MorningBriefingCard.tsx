'use client';

import { useState, useEffect } from 'react';
import { fetchRecentBriefings, markBriefingRead, type BriefingEntry } from '@/lib/ai/fetchBriefings';

type Props = {
  projectId: string;
};

/**
 * Morning Briefing Card — shows latest AI-generated briefing at top of Overview.
 * Dismissable, tracks read_at. Shows last 7 days of history.
 */
export function MorningBriefingCard({ projectId }: Props) {
  const [briefings, setBriefings] = useState<BriefingEntry[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchRecentBriefings(projectId).then(setBriefings).catch(() => {});
  }, [projectId]);

  const latest = briefings[0];
  if (!latest || dismissed) return null;

  const isToday = latest.briefingDate === new Date().toISOString().split('T')[0];
  const isUnread = !latest.readAt;

  async function handleDismiss() {
    if (isUnread) {
      await markBriefingRead(latest.id);
    }
    setDismissed(true);
  }

  return (
    <div className="space-y-3">
      {/* Latest briefing */}
      <div className={`rounded-lg border p-4 ${
        isToday
          ? 'border-amber-800/50 bg-amber-950/10'
          : 'border-zinc-800 bg-zinc-900'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">&#129302;</span>
            <div>
              <p className="text-[10px] font-medium text-amber-400">
                AI Briefing &middot; Based on project data as of {new Date(latest.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {isToday && isUnread && (
                <span className="inline-block mt-0.5 rounded-full bg-amber-600 px-1.5 py-0 text-[9px] font-bold text-white">
                  NEW
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="rounded px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              History
            </button>
            <button
              onClick={handleDismiss}
              className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
        </div>

        <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-zinc-300">
          {latest.content}
        </p>

        {latest.model !== 'fallback' && latest.model !== 'cached' && (
          <p className="mt-2 text-[9px] text-zinc-600">
            Model: {latest.model} &middot; {latest.language.toUpperCase()}
          </p>
        )}
      </div>

      {/* History (last 7 days) */}
      {showHistory && briefings.length > 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Past Briefings
          </p>
          <div className="space-y-3">
            {briefings.slice(1).map((b) => (
              <div key={b.id} className="border-l-2 border-zinc-800 pl-3">
                <p className="text-[10px] text-zinc-600">
                  {new Date(b.briefingDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">
                  {b.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
