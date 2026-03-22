'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { actionBus, type ActionEvent } from '../lib/ActionEventBus';

// ─── Metric Accumulator (never causes re-renders) ────

type Metrics = {
  totalOps: number;
  confirmedOps: number;
  revertedOps: number;
  totalLatencyMs: number;
  latencies: number[];
};

function createEmptyMetrics(): Metrics {
  return { totalOps: 0, confirmedOps: 0, revertedOps: 0, totalLatencyMs: 0, latencies: [] };
}

// ─── Component ───────────────────────────────────────

function EfficiencyDashboardComponent() {
  const metricsRef = useRef<Metrics>(createEmptyMetrics());
  const [displayMetrics, setDisplayMetrics] = useState<Metrics>(createEmptyMetrics());

  // Subscribe to bus — accumulate in ref (zero re-renders from events)
  useEffect(() => {
    return actionBus.subscribe((event: ActionEvent) => {
      const m = metricsRef.current;
      m.totalOps++;

      if (event.type === 'action:confirmed') {
        m.confirmedOps++;
        const latency = Date.now() - event.optimisticInsertedAt;
        m.totalLatencyMs += latency;
        m.latencies.push(latency);
      } else {
        m.revertedOps++;
      }
    });
  }, []);

  // Periodic display refresh (every 5s) — decoupled from bus events
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayMetrics({ ...metricsRef.current, latencies: [...metricsRef.current.latencies] });
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Derived KPIs ──────────────────────────────────

  const avgLatencyMs = displayMetrics.confirmedOps > 0
    ? displayMetrics.totalLatencyMs / displayMetrics.confirmedOps
    : 0;

  const errorRate = displayMetrics.totalOps > 0
    ? (displayMetrics.revertedOps / displayMetrics.totalOps) * 100
    : 0;

  const p95Latency = (() => {
    if (displayMetrics.latencies.length === 0) return 0;
    const sorted = [...displayMetrics.latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  })();

  // ─── Empty state ───────────────────────────────────

  if (displayMetrics.totalOps === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Operations
        </h3>
        <p className="mt-2 text-xs text-zinc-600">
          Aún sin operaciones en esta sesión.
        </p>
      </div>
    );
  }

  // ─── KPI Cards ─────────────────────────────────────

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Operations
      </h3>

      <div className="grid grid-cols-3 gap-3">
        {/* Avg Latency */}
        <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-3 text-center">
          <p className="text-[10px] text-zinc-500">Avg Latency</p>
          <p className="text-lg font-bold text-amber-400">
            {(avgLatencyMs / 1000).toFixed(1)}s
          </p>
        </div>

        {/* P95 */}
        <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-3 text-center">
          <p className="text-[10px] text-zinc-500">P95</p>
          <p className="text-lg font-bold text-zinc-200">
            {(p95Latency / 1000).toFixed(1)}s
          </p>
        </div>

        {/* Error Rate */}
        <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-3 text-center">
          <p className="text-[10px] text-zinc-500">Error Rate</p>
          <p className={`text-lg font-bold ${errorRate > 10 ? 'text-red-400' : 'text-green-400'}`}>
            {errorRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Operations count */}
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>{displayMetrics.confirmedOps} confirmed</span>
        <span>{displayMetrics.revertedOps} reverted</span>
        <span>{displayMetrics.totalOps} total</span>
      </div>
    </div>
  );
}

export const EfficiencyDashboard = memo(EfficiencyDashboardComponent);
