'use client';

import { useAlertMetrics } from '../hooks/useAlertMetrics';
import type { ProjectForecast, ScheduleComparisonRow } from '../types';

type ForecastSectionProps = {
  forecast: ProjectForecast;
  scheduleComparison?: ScheduleComparisonRow[];
};

/**
 * Section 3: "When does this end?"
 * Shows trend sparkline, scheduled vs projected dates, system health, and schedule comparison table.
 */
export function ForecastSection({ forecast, scheduleComparison }: ForecastSectionProps) {
  const alertMetrics = useAlertMetrics();

  const hasTrend = forecast.trendData.length > 0;
  const hasSchedule = forecast.scheduledDate && forecast.projectedDate;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Forecast</h2>
        <div className="flex items-center gap-3">
          {forecast.atRiskCount > 0 && (
            <span className="rounded-full bg-red-950/50 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-900/50">
              {forecast.atRiskCount} at risk
            </span>
          )}
          {forecast.criticalPathItems > 0 && (
            <span className="text-[10px] text-zinc-500">
              {forecast.criticalPathItems} critical path items
            </span>
          )}
        </div>
      </div>

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

      {/* Schedule Comparison Table */}
      {scheduleComparison && scheduleComparison.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Schedule vs Reality
          </p>
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
                {scheduleComparison.map((row, i) => {
                  const delta = row.deltaDays ?? 0;
                  const statusColor =
                    delta > 3 ? 'text-red-400' : delta > 0 ? 'text-yellow-400' : 'text-green-400';
                  const statusLabel =
                    delta > 3 ? 'AT RISK' : delta > 0 ? 'WATCH' : 'ON TRACK';

                  return (
                    <tr key={i} className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-300">
                        {row.isCritical && <span className="mr-1" title="Critical Path">&#9889;</span>}
                        {row.areaName}
                      </td>
                      <td className="py-2 text-zinc-400">{row.tradeName}</td>
                      <td className="py-2 text-right text-zinc-500">
                        {row.baselineFinish ? new Date(row.baselineFinish).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 text-right text-zinc-400">
                        {row.projectedDate ? new Date(row.projectedDate).toLocaleDateString() : '—'}
                      </td>
                      <td className={`py-2 text-right font-medium ${statusColor}`}>
                        {row.deltaDays !== null ? `${delta > 0 ? '+' : ''}${delta}d` : '—'}
                      </td>
                      <td className={`py-2 text-right text-[10px] font-semibold ${statusColor}`}>
                        {statusLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
