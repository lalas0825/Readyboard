'use client';

import { useState, useTransition } from 'react';
import type { FeedbackReport, FeedbackSummary } from '../services/fetchFeedback';
import { updateFeedbackStatus } from '../services/fetchFeedback';

// ─── Types ─────────────────────────────────────────

type Props = {
  reports: FeedbackReport[];
  summary: FeedbackSummary;
};

type StatusFilter = 'all' | FeedbackReport['status'];
type TypeFilter = 'all' | FeedbackReport['type'];

// ─── Helpers ───────────────────────────────────────

const TYPE_ICONS: Record<FeedbackReport['type'], string> = {
  bug: '🐛',
  feature_request: '💡',
  feedback: '💬',
  question: '❓',
};

const SEVERITY_COLORS: Record<FeedbackReport['severity'], string> = {
  low: 'text-zinc-400 bg-zinc-800',
  medium: 'text-amber-400 bg-amber-400/10',
  high: 'text-orange-400 bg-orange-400/10',
  critical: 'text-red-400 bg-red-400/10',
};

const STATUS_LABELS: Record<FeedbackReport['status'], string> = {
  new: 'New',
  reviewing: 'Reviewing',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  wont_fix: "Won't Fix",
  duplicate: 'Duplicate',
};

const STATUS_COLORS: Record<FeedbackReport['status'], string> = {
  new: 'text-blue-400 bg-blue-400/10',
  reviewing: 'text-amber-400 bg-amber-400/10',
  in_progress: 'text-cyan-400 bg-cyan-400/10',
  resolved: 'text-green-400 bg-green-400/10',
  wont_fix: 'text-zinc-500 bg-zinc-800',
  duplicate: 'text-zinc-500 bg-zinc-800',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ─────────────────────────────────────

export function FeedbackSection({ reports: initialReports, summary: initialSummary }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [summary] = useState(initialSummary);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FeedbackReport | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = reports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openDetail(report: FeedbackReport) {
    setSelected(report);
    setAdminNotes(report.adminNotes ?? '');
    setAdminResponse(report.adminResponse ?? '');
  }

  function handleStatusChange(newStatus: FeedbackReport['status']) {
    if (!selected) return;
    setSelected({ ...selected, status: newStatus });
  }

  function handleSave() {
    if (!selected) return;
    startTransition(async () => {
      const result = await updateFeedbackStatus(
        selected.id,
        selected.status,
        adminNotes,
        adminResponse,
      );
      if (result.ok) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === selected.id
              ? { ...r, status: selected.status, adminNotes, adminResponse }
              : r,
          ),
        );
        setSelected(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      <SectionHeader />

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'New', count: summary.new, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
          { label: 'Reviewing', count: summary.reviewing, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
          { label: 'In Progress', count: summary.in_progress, color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/20' },
          { label: 'Resolved', count: summary.resolved, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border ${s.bg} px-4 py-3`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="bug">🐛 Bug</option>
          <option value="feature_request">💡 Feature</option>
          <option value="feedback">💬 Feedback</option>
          <option value="question">❓ Question</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Status</option>
          {(Object.keys(STATUS_LABELS) as FeedbackReport['status'][]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none min-w-[120px]"
        />
        <span className="text-[10px] text-zinc-600">{filtered.length} reports</span>
      </div>

      {/* List */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">No reports found.</div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((report) => (
              <div
                key={report.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/30 cursor-pointer"
                onClick={() => openDetail(report)}
              >
                <span className="mt-0.5 text-base">{TYPE_ICONS[report.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {report.severity !== 'medium' || report.type === 'bug' ? (
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${SEVERITY_COLORS[report.severity]}`}>
                        {report.severity}
                      </span>
                    ) : null}
                    <span className="text-xs font-medium text-zinc-200 truncate">{report.title}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {report.reporterName ?? 'Unknown'} ({report.reporterRole ?? '?'})
                    {' · '}{report.appSource}
                    {' · '}{timeAgo(report.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[9px] font-medium ${STATUS_COLORS[report.status]}`}>
                    {STATUS_LABELS[report.status]}
                  </span>
                  <svg className="h-3 w-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel (modal) */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TYPE_ICONS[selected.type]}</span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{selected.title}</h3>
                  <p className="text-[10px] text-zinc-500">
                    {selected.reporterName} · {selected.reporterRole} · {selected.appSource} · {timeAgo(selected.createdAt)}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* Description */}
              {selected.description && (
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Description</label>
                  <p className="mt-1 text-xs text-zinc-300 whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}

              {/* Context */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 space-y-1">
                {selected.pageUrl && (
                  <p className="text-[10px] text-zinc-500">Page: <span className="text-zinc-400">{selected.pageUrl}</span></p>
                )}
                {selected.deviceInfo && (
                  <p className="text-[10px] text-zinc-500 truncate">Device: <span className="text-zinc-400">{selected.deviceInfo}</span></p>
                )}
                <p className="text-[10px] text-zinc-500">
                  Severity: <span className={`font-medium ${SEVERITY_COLORS[selected.severity].split(' ')[0]}`}>{selected.severity}</span>
                </p>
              </div>

              {/* Screenshots */}
              {selected.screenshots.length > 0 && (
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Screenshots</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {selected.screenshots.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-blue-400 hover:underline">
                        Screenshot {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Status</label>
                <select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(e.target.value as FeedbackReport['status'])}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                >
                  {(Object.keys(STATUS_LABELS) as FeedbackReport['status'][]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Admin notes (internal) */}
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Admin Notes <span className="text-zinc-600">(internal)</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes visible only to admins…"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none"
                />
              </div>

              {/* Admin response (visible to reporter) */}
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Response <span className="text-zinc-600">(visible to reporter)</span>
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  rows={2}
                  placeholder="Reply that the reporter will see in My Reports…"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="rounded-lg bg-amber-600 px-5 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-100">Feedback & Bug Reports</h2>
      <p className="mt-0.5 text-[10px] text-zinc-500">
        Reports submitted by your team via the 🐛 button on the dashboard or the mobile app.
      </p>
    </div>
  );
}
