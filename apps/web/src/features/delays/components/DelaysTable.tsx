'use client';

import { useState, useMemo } from 'react';
import { REASON_LABELS } from '@/lib/constants';
import { UpgradePrompt } from '@/features/billing/components/UpgradePrompt';
import { NodGenerateModal } from './NodGenerateModal';
import { EvidenceModal } from './EvidenceModal';
import type { DelayRow } from '../services/fetchDelayDetails';
import type { PlanId } from '@/lib/stripe';

// ─── Types ──────────────────────────────────────────

type Totals = {
  activeCount: number;
  closedCount: number;
  totalManHours: number;
  totalDailyCost: number;
  totalCumulativeCost: number;
};

type DelaysTableProps = {
  delays: DelayRow[];
  totals: Totals;
  laborRate: number;
  trades: string[];
  projectId: string;
  planId: PlanId;
};

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'closed';

// ─── Helpers ────────────────────────────────────────

function getSeverity(d: DelayRow): 'critical' | 'high' | 'medium' | 'low' {
  if (d.cumulativeCost >= 10000 || d.durationHours >= 168) return 'critical';
  if (d.cumulativeCost >= 5000 || d.durationHours >= 72) return 'high';
  if (d.cumulativeCost >= 1000 || d.durationHours >= 24) return 'medium';
  return 'low';
}

function severityBadge(sev: ReturnType<typeof getSeverity>) {
  const styles = {
    critical: 'border-red-800/50 bg-red-950/30 text-red-400',
    high: 'border-orange-800/50 bg-orange-950/30 text-orange-400',
    medium: 'border-amber-800/50 bg-amber-950/30 text-amber-400',
    low: 'border-zinc-700 bg-zinc-800 text-zinc-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase border ${styles[sev]}`}>
      {sev}
    </span>
  );
}

function legalBadge(status: DelayRow['legalStatus']) {
  if (!status) return <span className="text-[10px] text-zinc-600">--</span>;
  const styles = {
    pending: 'border-amber-800/50 bg-amber-950/30 text-amber-400',
    draft: 'border-blue-800/50 bg-blue-950/30 text-blue-400',
    sent: 'border-green-800/50 bg-green-950/30 text-green-400',
    signed: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase border ${styles[status]}`}>
      {status}
    </span>
  );
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return remaining > 0 ? `${days}d ${remaining}h` : `${days}d`;
}

const PAGE_SIZE = 20;

// ─── Component ──────────────────────────────────────

export function DelaysTable({ delays, totals, laborRate, trades, projectId, planId }: DelaysTableProps) {
  // Filters
  const [tradeFilter, setTradeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  // Modals
  const [nodDelayId, setNodDelayId] = useState<string | null>(null);
  const [evidenceDelay, setEvidenceDelay] = useState<DelayRow | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const isStarter = planId === 'starter';

  // Filtered + paginated delays
  const filtered = useMemo(() => {
    let result = delays;

    if (tradeFilter !== 'all') {
      result = result.filter((d) => d.tradeName === tradeFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter((d) => getSeverity(d) === severityFilter);
    }
    if (statusFilter === 'active') {
      result = result.filter((d) => d.isActive);
    } else if (statusFilter === 'closed') {
      result = result.filter((d) => !d.isActive);
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((d) => new Date(d.startedAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // end of day
      result = result.filter((d) => new Date(d.startedAt).getTime() <= to);
    }

    return result;
  }, [delays, tradeFilter, severityFilter, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const resetPage = () => setPage(0);

  const handleGenerateNod = (delayId: string) => {
    if (isStarter) {
      setShowUpgradePrompt(true);
      return;
    }
    setNodDelayId(delayId);
  };

  return (
    <div className="space-y-6">
      {/* ─── Summary Cards ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Active Delays" value={String(totals.activeCount)} accent="red" />
        <SummaryCard label="Closed" value={String(totals.closedCount)} accent="zinc" />
        <SummaryCard label="Total Man Hours" value={totals.totalManHours.toLocaleString()} accent="amber" />
        <SummaryCard label="Daily Burn Rate" value={formatCurrency(totals.totalDailyCost)} accent="orange" />
        <SummaryCard label="Cumulative Cost" value={formatCurrency(totals.totalCumulativeCost)} accent="red" />
      </div>

      {laborRate === 0 && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3">
          <p className="text-xs text-amber-400">
            Labor rate is not configured. Cost calculations will show $0.
            <a href="/dashboard/settings" className="ml-1 underline hover:text-amber-300">
              Configure in Settings
            </a>
          </p>
        </div>
      )}

      {/* ─── Filters ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tradeFilter}
          onChange={(e) => { setTradeFilter(e.target.value); resetPage(); }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none"
        >
          <option value="all">All Trades</option>
          {trades.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value as SeverityFilter); resetPage(); }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical ($10K+ or 7d+)</option>
          <option value="high">High ($5K+ or 3d+)</option>
          <option value="medium">Medium ($1K+ or 1d+)</option>
          <option value="low">Low</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); resetPage(); }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none"
        >
          <option value="all">Active & Closed</option>
          <option value="active">Active Only</option>
          <option value="closed">Closed Only</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
          placeholder="From"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
          placeholder="To"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none"
        />

        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} delay{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ─── Table ─────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="px-3 py-2.5 font-medium text-zinc-400">Area</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400">Trade</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400">Reason</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400">Severity</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 text-right">Duration</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 text-right">Daily Cost</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 text-right">Cumulative</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 text-center">GPS</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 text-center">Legal</th>
              <th className="px-3 py-2.5 font-medium text-zinc-400 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                  No delays match your filters.
                </td>
              </tr>
            )}
            {paginated.map((d) => (
              <tr
                key={d.id}
                className={`transition-colors hover:bg-zinc-900/50 ${
                  d.isActive ? '' : 'opacity-60'
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] font-medium text-zinc-400">
                      F{d.floor}
                    </span>
                    <span className="text-zinc-200">{d.areaName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-300">{d.tradeName}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {REASON_LABELS[d.reasonCode] ?? d.reasonCode}
                  </span>
                </td>
                <td className="px-3 py-2.5">{severityBadge(getSeverity(d))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-300">
                  {formatDuration(d.durationHours)}
                  {d.isActive && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-300">
                  {formatCurrency(d.dailyCost)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-amber-400">
                  {formatCurrency(d.cumulativeCost)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {d.hasFieldReport ? (
                    <button
                      onClick={() => setEvidenceDelay(d)}
                      className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-amber-700 hover:text-amber-400"
                      title={d.gpsLat && d.gpsLng ? `${d.gpsLat}, ${d.gpsLng}` : 'View evidence'}
                    >
                      {d.gpsLat ? 'GPS' : 'Photo'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-600">--</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">{legalBadge(d.legalStatus)}</td>
                <td className="px-3 py-2.5 text-center">
                  {d.isActive && !d.legalStatus && (
                    <button
                      onClick={() => handleGenerateNod(d.id)}
                      className="rounded border border-amber-700/50 bg-amber-950/30 px-2 py-1 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-900/30"
                    >
                      Generate NOD
                    </button>
                  )}
                  {d.legalStatus === 'pending' && (
                    <button
                      onClick={() => handleGenerateNod(d.id)}
                      className="rounded border border-blue-700/50 bg-blue-950/30 px-2 py-1 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-900/30"
                    >
                      Draft NOD
                    </button>
                  )}
                  {d.legalStatus === 'draft' && (
                    <span className="text-[10px] text-blue-400">Awaiting Sign</span>
                  )}
                  {d.legalStatus === 'sent' && (
                    <span className="text-[10px] text-green-400">Sent</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination ────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ─── Upgrade Prompt (Starter plan) ──────────── */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md">
            <UpgradePrompt
              projectId={projectId}
              feature="NOD Generation"
              description="Generate Notices of Delay with SHA-256 hashing, signature capture, and receipt tracking."
            />
            <button
              onClick={() => setShowUpgradePrompt(false)}
              className="mt-3 w-full rounded-md border border-zinc-700 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── NOD Generation Modal ──────────────────── */}
      {nodDelayId && (
        <NodGenerateModal
          delayId={nodDelayId}
          onClose={() => setNodDelayId(null)}
        />
      )}

      {/* ─── Evidence Modal (GPS + Photos) ─────────── */}
      {evidenceDelay && (
        <EvidenceModal
          delay={evidenceDelay}
          onClose={() => setEvidenceDelay(null)}
        />
      )}
    </div>
  );
}

// ─── Summary Card ───────────────────────────────────

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const borderColor = {
    red: 'border-red-900/50',
    orange: 'border-orange-900/50',
    amber: 'border-amber-900/50',
    zinc: 'border-zinc-800',
  }[accent] ?? 'border-zinc-800';

  const textColor = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    zinc: 'text-zinc-300',
  }[accent] ?? 'text-zinc-300';

  return (
    <div className={`rounded-lg border ${borderColor} bg-zinc-900 p-3`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
