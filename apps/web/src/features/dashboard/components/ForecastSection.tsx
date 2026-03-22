'use client';

import { useAlertMetrics } from '../hooks/useAlertMetrics';
import type { ProjectForecast } from '../types';

type ForecastSectionProps = {
  forecast: ProjectForecast;
};

/**
 * Section 3: "When does this end?"
 * Shows trend sparkline, scheduled vs projected dates, and system health from bus.
 */
export function ForecastSection({ forecast }: ForecastSectionProps) {
  const alertMetrics = useAlertMetrics();

  const hasTrend = forecast.trendData.length > 0;
  const hasSchedule = forecast.scheduledDate && forecast.projectedDate;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Forecast</h2>

      <div className="grid grid-cols-2 gap-3">
        {/* Schedule Delta */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Schedule Delta</p>
          {hasSchedule ? (
            <>
              <p
                className={`mt-1 text-2xl font-bold ${
                  forecast.deltaDays !== null && forecast.deltaDays > 0
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}
              >
                {forecast.deltaDays !== null
                  ? `${forecast.deltaDays > 0 ? '+' : ''}${forecast.deltaDays}d`
                  : '—'}
              </p>
              <div className="mt-2 space-y-1 text-[10px] text-zinc-500">
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span>{new Date(forecast.scheduledDate!).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected</span>
                  <span>{new Date(forecast.projectedDate!).toLocaleDateString()}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-zinc-600">
              Datos insuficientes para proyección.
            </p>
          )}
        </div>

        {/* System Health (from bus) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">System Health</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              alertMetrics.ratio >= 0.9
                ? 'text-green-400'
                : alertMetrics.ratio >= 0.7
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}
          >
            {(alertMetrics.ratio * 100).toFixed(0)}%
          </p>
          <div className="mt-2 space-y-1 text-[10px] text-zinc-500">
            <div className="flex justify-between">
              <span>Confirmed</span>
              <span className="text-green-400">{alertMetrics.confirmedOps}</span>
            </div>
            <div className="flex justify-between">
              <span>Reverted</span>
              <span className={alertMetrics.revertedOps > 0 ? 'text-red-400' : ''}>
                {alertMetrics.revertedOps}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Sparkline (14-day) */}
      {hasTrend && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            14-Day Trend
          </p>
          <TrendSparkline data={forecast.trendData.map((d) => d.effectivePct)} />
        </div>
      )}
    </div>
  );
}

/** Simple CSS bar chart — no charting library needed */
function TrendSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 40 }}>
      {data.map((value, i) => {
        const heightPct = (value / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm bg-amber-500/60 transition-all"
            style={{ height: `${Math.max(heightPct, 4)}%` }}
            title={`${value.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}
