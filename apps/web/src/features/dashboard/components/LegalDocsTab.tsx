'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchLegalDocs } from '../services/fetchLegalDocs';
import { publishLegalDoc } from '../services/publishLegalDoc';
import { CreateDocModal } from './CreateDocModal';
import { GenerateReaModal } from './GenerateReaModal';
import { GenerateEvidencePackageModal } from './GenerateEvidencePackageModal';
import { EscalationAlertsSection } from './EscalationAlertsSection';
import type { LegalDoc } from '../types';

// ─── Config ──────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  nod:      { label: 'NOD',      color: 'text-purple-400', bg: 'bg-purple-950/30', border: 'border-purple-900/50' },
  rea:      { label: 'REA',      color: 'text-amber-400',  bg: 'bg-amber-950/30',  border: 'border-amber-900/50' },
  evidence: { label: 'Evidence', color: 'text-blue-400',   bg: 'bg-blue-950/30',   border: 'border-blue-900/50' },
};

// ─── Helpers ─────────────────────────────────────────

function deriveDocStatus(doc: LegalDoc): { label: string; color: string } {
  if (doc.publishedToGc) return { label: 'Published', color: 'text-green-400' };
  if (doc.sentAt) return { label: 'Sent', color: 'text-cyan-400' };
  return { label: 'Draft', color: 'text-zinc-400' };
}

function deriveReceiptStatus(doc: LegalDoc): { label: string; color: string; urgent: boolean } {
  if (!doc.sentAt) return { label: '', color: '', urgent: false };

  if (!doc.firstOpenedAt) {
    const hoursSince = (Date.now() - new Date(doc.sentAt).getTime()) / 3_600_000;
    if (hoursSince > 72) return { label: '72h+ Never Opened', color: 'text-red-400', urgent: true };
    return { label: 'Unopened', color: 'text-zinc-500', urgent: false };
  }

  const hoursSinceOpen = (Date.now() - new Date(doc.firstOpenedAt).getTime()) / 3_600_000;
  if (hoursSinceOpen > 48) return { label: '48h+ No Response', color: 'text-red-400', urgent: true };
  return { label: `Opened ${doc.openCount}x`, color: 'text-green-400', urgent: false };
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ───────────────────────────────────────

type LegalDocsTabProps = {
  projectId: string;
};

export function LegalDocsTab({ projectId }: LegalDocsTabProps) {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReaModal, setShowReaModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchLegalDocs(projectId);
    setDocs(result);
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handlePublish = async (docId: string) => {
    setPublishingId(docId);
    const result = await publishLegalDoc(docId);
    if (result.ok) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, publishedToGc: true, publishedAt: new Date().toISOString() }
            : d,
        ),
      );
      toast.success('Document published to GC');
    } else {
      toast.error('Failed to publish document');
    }
    setPublishingId(null);
  };

  const handleDocCreated = (newDoc: LegalDoc) => {
    setDocs((prev) => [newDoc, ...prev]);
  };

  const handleGenerated = () => {
    loadDocs();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading legal documents...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Escalation Alerts — above everything */}
      <EscalationAlertsSection projectId={projectId} />

      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Legal Documents
          {docs.length > 0 && (
            <span className="ml-2 text-[10px] font-normal text-zinc-600">{docs.length} total</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReaModal(true)}
            className="rounded-md border border-amber-700 px-2.5 py-1 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-950/50"
          >
            Generate REA
          </button>
          <button
            onClick={() => setShowEvidenceModal(true)}
            className="rounded-md border border-blue-700 px-2.5 py-1 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-950/50"
          >
            Evidence Package
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            + New Draft
          </button>
        </div>
      </div>

      {/* Empty state */}
      {docs.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-400">No legal documents yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Create your first document to start building your legal paper trail.
          </p>
        </div>
      )}

      {/* Document list */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc) => {
            const typeCfg = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.nod;
            const status = deriveDocStatus(doc);
            const receipt = deriveReceiptStatus(doc);

            return (
              <div
                key={doc.id}
                className={`rounded-lg border bg-zinc-900 px-4 py-3 ${
                  receipt.urgent ? 'border-red-900/50' : 'border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left: type badge + details */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border}`}
                    >
                      {typeCfg.label}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-200">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                        {doc.totalClaimAmount != null && doc.totalClaimAmount > 0 && (
                          <span className="text-xs font-semibold text-amber-400">
                            {formatCurrency(doc.totalClaimAmount)}
                          </span>
                        )}
                      </div>
                      {(doc.areaName || doc.tradeName) && (
                        <p className="text-[10px] text-zinc-500">
                          {[doc.areaName, doc.tradeName].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {doc.sha256Hash && (
                        <p className="text-[10px] text-zinc-600 font-mono">
                          SHA: {doc.sha256Hash.slice(0, 12)}...
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Center: status + receipt */}
                  <div className="text-center">
                    <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
                    {receipt.label && (
                      <p className={`text-[10px] font-medium ${receipt.color}`}>
                        {receipt.label}
                      </p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="w-28 text-right space-y-1">
                    {doc.pdfUrl && (
                      <a
                        href={doc.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-amber-400 underline hover:text-amber-300"
                      >
                        View PDF
                      </a>
                    )}
                    {!doc.publishedToGc && doc.sentAt && (
                      <button
                        onClick={() => handlePublish(doc.id)}
                        disabled={publishingId === doc.id}
                        className="block w-full rounded-md border border-green-700 px-2 py-0.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-950/50 disabled:opacity-50"
                      >
                        {publishingId === doc.id ? '...' : 'Publish to GC'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateDocModal
        projectId={projectId}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleDocCreated}
      />
      <GenerateReaModal
        projectId={projectId}
        open={showReaModal}
        onClose={() => setShowReaModal(false)}
        onGenerated={handleGenerated}
      />
      <GenerateEvidencePackageModal
        projectId={projectId}
        open={showEvidenceModal}
        onClose={() => setShowEvidenceModal(false)}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
