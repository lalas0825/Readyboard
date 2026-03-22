import type { ProjectMetrics } from '../types';

type MetricsSectionProps = {
  metrics: ProjectMetrics;
  onAddArea?: () => void;
};

/**
 * Section 1: "What's happening right now?"
 * 4 KPI cards showing project health at a glance.
 */
export function MetricsSection({ metrics, onAddArea }: MetricsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          {metrics.projectName || 'Project Overview'}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{metrics.totalAreas} areas</span>
          {onAddArea && metrics.totalAreas > 0 && (
            <button
              onClick={onAddArea}
              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-amber-700 hover:text-amber-400"
            >
              + Add Area
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {/* Project % */}
        <MetricCard
          label="Project"
          value={`${Math.round(metrics.overallPct)}%`}
          color="text-amber-400"
        />

        {/* On Track */}
        <MetricCard
          label="On Track"
          value={String(metrics.onTrack)}
          color="text-green-400"
        />

        {/* Attention */}
        <MetricCard
          label="Attention"
          value={String(metrics.attention)}
          color={metrics.attention > 0 ? 'text-yellow-400' : 'text-zinc-500'}
        />

        {/* Action Required */}
        <MetricCard
          label="Action Req."
          value={String(metrics.actionRequired)}
          color={metrics.actionRequired > 0 ? 'text-red-400' : 'text-zinc-500'}
        />
      </div>

      {/* Overall progress bar */}
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full bg-amber-500 transition-all"
          style={{ width: `${Math.min(metrics.overallPct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
