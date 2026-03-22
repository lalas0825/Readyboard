'use client';

export type TimelineEvent = {
  label: string;
  timestamp: string;
  color: string;
};

type StatusTimelineProps = {
  events: TimelineEvent[];
};

/**
 * Vertical timeline with dots + connecting lines.
 * Renders events sorted by timestamp (newest first).
 */
export function StatusTimeline({ events }: StatusTimelineProps) {
  if (events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="space-y-0">
      {sorted.map((event, i) => (
        <div key={`${event.timestamp}-${i}`} className="flex gap-3">
          {/* Dot + line */}
          <div className="flex flex-col items-center">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            {i < sorted.length - 1 && (
              <div className="w-px flex-1 bg-zinc-700" />
            )}
          </div>

          {/* Content */}
          <div className="pb-3">
            <p className="text-xs font-medium text-zinc-300">{event.label}</p>
            <p className="text-[10px] text-zinc-500">
              {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
