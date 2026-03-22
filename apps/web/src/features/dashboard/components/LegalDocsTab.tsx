'use client';

import { useEffect, useState } from 'react';
import { fetchLegalDocs } from '../services/fetchLegalDocs';
import { publishLegalDoc } from '../services/publishLegalDoc';
import { CreateDocModal } from './CreateDocModal';
import type { LegalDoc } from '../types';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  nod:      { label: 'NOD',      color: 'text-purple-400', bg: 'bg-purple-950/30', border: 'border-purple-900/50' },
  rea:      { label: 'REA',      color: 'text-amber-400',  bg: 'bg-amber-950/30',  border: 'border-amber-900/50' },
  evidence: { label: 'Evidence', color: 'text-blue-400',   bg: 'bg-blue-950/30',   border: 'border-blue-900/50' },
};

function deriveDocStatus(doc: LegalDoc): { label: string; color: string } {
  if (doc.publishedToGc) return { label: 'Published', color: 'text-green-400' };
  if (doc.sentAt) return { label: 'Sent', color: 'text-cyan-400' };
  return { label: 'Draft', color: 'text-zinc-400' };
}

type LegalDocsTabProps = {
  projectId: string;
};

export function LegalDocsTab({ projectId }: LegalDocsTabProps) {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchLegalDocs(projectId).then((result) => {
      if (!cancelled) {
        setDocs(result);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [projectId]);

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
    }
    setPublishingId(null);
  };

  const handleDocCreated = (newDoc: LegalDoc) => {
    setDocs((prev) => [newDoc, ...prev]);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading legal documents...
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Legal Documents
        </h2>
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-400">No legal documents yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Create your first document to start building your legal paper trail.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 rounded-md border border-amber-700 bg-amber-950/50 px-5 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/50"
          >
            Create First Document
          </button>
        </div>

        <CreateDocModal
          projectId={projectId}
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleDocCreated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Legal Documents
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{docs.length} total</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md border border-amber-700 px-2.5 py-1 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-950/50"
          >
            + New Document
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {docs.map((doc) => {
          const typeCfg = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.nod;
          const status = deriveDocStatus(doc);

          return (
            <div
              key={doc.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                {/* Left: type badge + date */}
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border}`}
                  >
                    {typeCfg.label}
                  </span>
                  <div>
                    <p className="text-sm text-zinc-200">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                    {doc.sha256Hash && (
                      <p className="text-[10px] text-zinc-600 font-mono">
                        SHA: {doc.sha256Hash.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                </div>

                {/* Center: status */}
                <div className="text-center">
                  <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
                  {doc.openCount > 0 && (
                    <p className="text-[10px] text-zinc-500">
                      Opened {doc.openCount}x
                    </p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="w-24 text-right">
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
                  {!doc.publishedToGc && (
                    <button
                      onClick={() => handlePublish(doc.id)}
                      disabled={publishingId === doc.id}
                      className="mt-1 block w-full rounded-md border border-green-700 px-2 py-0.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-950/50 disabled:opacity-50"
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

      <CreateDocModal
        projectId={projectId}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleDocCreated}
      />
    </div>
  );
}
