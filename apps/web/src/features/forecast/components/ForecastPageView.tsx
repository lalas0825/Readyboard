'use client';

import type { ForecastPageData, TrendPoint } from '../services/fetchForecastPage';
import type { ScheduleComparisonRow } from '../types';

type Props = {
  data: ForecastPageData;
};

export function ForecastPageView({ data }: Props) {
  const hasSchedule = data.scheduledDate && data.projectedDate;
  const hasTrend = data.trendData.length > 1;

  return (
    <div className="space-y-6">
      {/* ─── Summary Cards ──────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Overall Progress"
          value={`${data.overallPct.toFixed(1)}%`}
          accent={data.overallPct > 50 ? 'green' : 'amber'}
        />
        <MetricCard
          label="Schedule Delta"
          value={data.deltaDays != null ? `${data.deltaDays > 0 ? '+' : ''}${data.deltaDays}d` : 'N/A'}
          accent={data.deltaDays != null && data.deltaDays > 3 ? 'red' : data.deltaDays != null && data.deltaDays > 0 ? 'amber' : 'green'}
        />
        <MetricCard
          label="At Risk Areas"
          value={String(data.atRiskCount)}
          accent={data.atRiskCount > 0 ? 'red' : 'green'}
        />
        <MetricCard
          label="Critical Path Items"
          value={String(data.criticalPathItems)}
          accent={data.criticalPathItems > 0 ? 'amber' : 'zinc'}
        />
      </div>

      {/* ─── Projected Finish ──────────────────── */}
      {hasSchedule && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Original Finish Date</p>
            <p className="mt-1 text-lg font-bold text-zinc-300">
              {new Date(data.scheduledDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Projected Finish Date</p>
            <p className={`mt-1 text-lg font-bold ${
              data.deltaDays != null && data.deltaDays > 3 ? 'text-red-400' :
              data.deltaDays != null && data.deltaDays > 0 ? 'text-amber-400' : 'text-green-400'
            }`}>
              {new Date(data.projectedDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {!hasSchedule && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
          <p className="text-sm text-zinc-400">Insufficient data for projections.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Import a P6 schedule in <a href="/dashboard/schedule" className="underline text-amber-500">Schedule</a> to enable forecasting.
          </p>
        </div>
      )}

      {/* ─── Trend Chart (SVG) ─────────────────── */}
      {hasTrend && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            14-Day Progress Trend
          </p>
          <ProgressChart data={data.trendData} />
        </div>
      )}

      {/* ─── Schedule vs Reality Table ──────────── */}
      {data.scheduleComparison.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Schedule vs Reality
            </p>
            <span className="text-[10px] text-zinc-600">
              {data.scheduleComparison.length} items
            </span>
          </div>
          <ComparisonTable rows={data.scheduleComparison} />
        </div>
      )}

      {/* ─── At Risk Areas ─────────────────────── */}
      {data.atRiskAreas.length > 0 && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-red-400">
            At Risk ({data.atRiskAreas.length})
          </p>
          <ComparisonTable rows={data.atRiskAreas} />
        </div>
      )}
    </div>
  );
}

// ─── SVG Chart ──────────────────────────────────────

function ProgressChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) return null;

  const width = 600;
  const height = 140;
  const padding = { top: 10, right: 10, bottom: 25, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.effectivePct);
  const minVal = Math.max(0, Math.min(...values) - 5);
  const maxVal = Math.min(100, Math.max(...values) + 5);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.effectivePct - minVal) / range) * chartH;
    return { x, y, pct: d.effectivePct, date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Y-axis labels
  const yLabels = [minVal, (minVal + maxVal) / 2, maxVal];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 160 }}>
      {/* Grid lines */}
      {yLabels.map((val, i) => {
        const y = padding.top + chartH - ((val - minVal) / range) * chartH;
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#27272a" strokeWidth={1} />
            <text x={padding.left - 4} y={y + 3} textAnchor="end" fill="#52525b" fontSize={9}>
              {val.toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#chartGradient)" opacity={0.3} />
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#f59e0b" stroke="#18181b" strokeWidth={1.5}>
          <title>{`${p.date}: ${p.pct.toFixed(1)}%`}</title>
        </circle>
      ))}

      {/* X-axis labels (first, middle, last) */}
      {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
        const p = points[idx];
        if (!p) return null;
        const label = new Date(data[idx].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <text key={idx} x={p.x} y={height - 4} textAnchor="middle" fill="#52525b" fontSize={9}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Comparison Table ───────────────────────────────

function ComparisonTable({ rows }: { rows: ScheduleComparisonRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500">
            <th className="pb-2 text-left font-medium">Area</th>
            <th className="pb-2 text-left font-medium">Trade</th>
            <th className="pb-2 text-right font-medium">Baseline</th>
            <th className="pb-2 text-right font-medium">Projected</th>
            <th className="pb-2 text-right font-medium">Delta</th>
            <th className="pb-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const delta = row.deltaDays ?? 0;
            const color = delta > 3 ? 'text-red-400' : delta > 0 ? 'text-yellow-400' : 'text-green-400';
            const label = delta > 3 ? 'AT RISK' : delta > 0 ? 'WATCH' : 'ON TRACK';
            return (
              <tr key={i} className="border-b border-zinc-800/50">
                <td className="py-2 text-zinc-300">
                  {row.isCritical && <span className="mr-1 text-amber-400" title="Critical Path">&#9889;</span>}
                  {row.areaName}
                </td>
                <td className="py-2 text-zinc-400">{row.tradeName}</td>
                <td className="py-2 text-right text-zinc-500">
                  {row.baselineFinish ? new Date(row.baselineFinish).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                </td>
                <td className="py-2 text-right text-zinc-400">
                  {row.projectedDate ? new Date(row.projectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                </td>
                <td className={`py-2 text-right font-medium ${color}`}>
                  {row.deltaDays != null ? `${delta > 0 ? '+' : ''}${delta}d` : '--'}
                </td>
                <td className={`py-2 text-right text-[10px] font-semibold ${color}`}>
                  {label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const border = { red: 'border-red-900/50', amber: 'border-amber-900/50', green: 'border-green-900/50', zinc: 'border-zinc-800' }[accent] ?? 'border-zinc-800';
  const text = { red: 'text-red-400', amber: 'text-amber-400', green: 'text-green-400', zinc: 'text-zinc-300' }[accent] ?? 'text-zinc-300';

  return (
    <div className={`rounded-lg border ${border} bg-zinc-900 p-3`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${text}`}>{value}</p>
    </div>
  );
}
