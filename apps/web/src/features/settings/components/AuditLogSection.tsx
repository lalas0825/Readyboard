'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAuditLog, type AuditEntry } from '../services/fetchAuditLog';

type Props = {
  projectId: string;
};

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  config_change: { label: 'Config', color: 'text-blue-400 border-blue-800/50 bg-blue-950/30' },
  legal_doc_sent: { label: 'Legal Sent', color: 'text-green-400 border-green-800/50 bg-green-950/30' },
  legal_draft_created: { label: 'Draft', color: 'text-cyan-400 border-cyan-800/50 bg-cyan-950/30' },
  legal_doc_published: { label: 'Published', color: 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30' },
  ca_created: { label: 'CA Created', color: 'text-amber-400 border-amber-800/50 bg-amber-950/30' },
  ca_acknowledged: { label: 'CA Ack', color: 'text-amber-400 border-amber-800/50 bg-amber-950/30' },
  ca_resolved: { label: 'CA Resolved', color: 'text-green-400 border-green-800/50 bg-green-950/30' },
  gc_verification_approved: { label: 'Verified', color: 'text-green-400 border-green-800/50 bg-green-950/30' },
  gc_correction_requested: { label: 'Correction', color: 'text-red-400 border-red-800/50 bg-red-950/30' },
  invite_created: { label: 'Invite', color: 'text-purple-400 border-purple-800/50 bg-purple-950/30' },
  invite_redeemed: { label: 'Redeemed', color: 'text-purple-400 border-purple-800/50 bg-purple-950/30' },
  subscription_created: { label: 'Sub Created', color: 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30' },
  subscription_updated: { label: 'Sub Updated', color: 'text-blue-400 border-blue-800/50 bg-blue-950/30' },
  payment_failed: { label: 'Pay Failed', color: 'text-red-400 border-red-800/50 bg-red-950/30' },
  rea_generated: { label: 'REA', color: 'text-amber-400 border-amber-800/50 bg-amber-950/30' },
  receipt_opened: { label: 'Receipt', color: 'text-zinc-400 border-zinc-700 bg-zinc-800' },
};

export function AuditLogSection({ projectId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    const result = await fetchAuditLog(projectId, PAGE_SIZE, p * PAGE_SIZE);
    setEntries(result.entries);
    setTotal(result.total);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadPage(page);
  }, [page, loadPage]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Audit Logs</h2>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Immutable record of all system actions. For legal compliance and dispute resolution.
          </p>
        </div>
        <span className="text-[10px] text-zinc-500">{total} entries</span>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-xs text-zinc-500">Loading audit entries...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-zinc-500">No audit entries found.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-3 py-2.5 font-medium text-zinc-400">Time</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">Action</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">Table</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">User</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400">Reason</th>
                <th className="px-3 py-2.5 font-medium text-zinc-400 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {entries.map((entry) => {
                const actionConfig = ACTION_LABELS[entry.action] ?? {
                  label: entry.action.replace(/_/g, ' '),
                  color: 'text-zinc-400 border-zinc-700 bg-zinc-800',
                };
                const isExpanded = expandedId === entry.id;

                return (
                  <tr key={entry.id} className="group">
                    <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase border ${actionConfig.color}`}>
                        {actionConfig.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                      {entry.tableName}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">{entry.changedByName}</td>
                    <td className="px-3 py-2.5 text-zinc-500 max-w-48 truncate">
                      {entry.reason ?? '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {(entry.oldValue || entry.newValue) && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800"
                        >
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Expanded detail */}
      {expandedId && (() => {
        const entry = entries.find((e) => e.id === expandedId);
        if (!entry) return null;
        return (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
            <p className="text-[10px] font-medium text-zinc-400">Audit Detail — {entry.action}</p>
            <div className="grid grid-cols-2 gap-4">
              {entry.oldValue && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">Previous Value</p>
                  <pre className="rounded bg-zinc-900 p-2 text-[10px] text-zinc-400 overflow-auto max-h-32">
                    {JSON.stringify(entry.oldValue, null, 2)}
                  </pre>
                </div>
              )}
              {entry.newValue && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">New Value</p>
                  <pre className="rounded bg-zinc-900 p-2 text-[10px] text-amber-400 overflow-auto max-h-32">
                    {JSON.stringify(entry.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-zinc-700 px-3 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border border-zinc-700 px-3 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
