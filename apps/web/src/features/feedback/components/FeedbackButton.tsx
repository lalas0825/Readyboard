'use client';

import { useState, useRef, useEffect } from 'react';
import { submitFeedback } from '../services/submitFeedback';

// ─── Types ─────────────────────────────────────────

type FeedbackType = 'bug' | 'feature_request' | 'feedback' | 'question';
type Severity = 'low' | 'medium' | 'high' | 'critical';

// ─── Component ─────────────────────────────────────

export function FeedbackButton({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-capture page context
  const pageUrl = typeof window !== 'undefined' ? window.location.pathname : '';
  const deviceInfo =
    typeof navigator !== 'undefined'
      ? `${navigator.userAgent} | ${window.innerWidth}×${window.innerHeight}`
      : '';

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setType('bug');
        setSeverity('medium');
        setTitle('');
        setDescription('');
        setScreenshots([]);
        setSubmitted(false);
        setError('');
      }, 300);
    }
  }, [open]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setScreenshots((prev) => [...prev, ...files].slice(0, 3));
    e.target.value = '';
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError('');

    // TODO: upload screenshots to Supabase Storage and get URLs
    // For now, submit without screenshot URLs
    const result = await submitFeedback({
      projectId,
      type,
      severity,
      title,
      description,
      pageUrl,
      deviceInfo,
      screenshots: [],
    });

    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
    } else {
      setError(result.error ?? 'Failed to submit. Please try again.');
    }
  }

  const TYPES: { key: FeedbackType; label: string; icon: string }[] = [
    { key: 'bug', label: 'Bug', icon: '🐛' },
    { key: 'feature_request', label: 'Feature', icon: '💡' },
    { key: 'feedback', label: 'Feedback', icon: '💬' },
    { key: 'question', label: 'Question', icon: '❓' },
  ];

  const SEVERITIES: { key: Severity; label: string; color: string }[] = [
    { key: 'low', label: 'Low', color: 'text-zinc-400 border-zinc-700' },
    { key: 'medium', label: 'Medium', color: 'text-amber-400 border-amber-700' },
    { key: 'high', label: 'High', color: 'text-orange-400 border-orange-700' },
    { key: 'critical', label: 'Critical', color: 'text-red-400 border-red-700' },
  ];

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-full bg-zinc-800/90 px-3 py-2 text-xs text-zinc-300 shadow-lg ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-zinc-700 sm:px-3 sm:py-2"
        title="Report a bug or send feedback"
      >
        <span className="text-sm">🐛</span>
        <span className="hidden sm:inline">Report</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Send Feedback</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-500 hover:text-zinc-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {submitted ? (
              /* Success state */
              <div className="flex flex-col items-center gap-3 px-5 py-10">
                <div className="text-4xl">✅</div>
                <p className="text-sm font-semibold text-zinc-100">Report submitted!</p>
                <p className="text-center text-xs text-zinc-500">
                  Thanks for the feedback. We&apos;ll review it shortly.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-lg bg-zinc-800 px-6 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
                {/* Type selector */}
                <div>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Type
                  </label>
                  <div className="flex gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setType(t.key)}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-medium transition-colors ${
                          type === t.key
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                        }`}
                      >
                        <span className="text-base">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity — bugs only */}
                {type === 'bug' && (
                  <div>
                    <label className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Severity
                    </label>
                    <div className="flex gap-2">
                      {SEVERITIES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setSeverity(s.key)}
                          className={`flex-1 rounded-lg border py-1.5 text-[10px] font-medium transition-colors ${
                            severity === s.key
                              ? `${s.color} bg-white/5`
                              : 'border-zinc-800 text-zinc-600 hover:border-zinc-700'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="One-line summary…"
                    maxLength={120}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Details */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Details
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, expected vs actual behavior…"
                    rows={3}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Screenshots */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Screenshots ({screenshots.length}/3)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {screenshots.map((file, i) => (
                      <div key={i} className="relative">
                        <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300">
                          <span>📎</span>
                          <span className="max-w-[100px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeScreenshot(i)}
                            className="ml-1 text-zinc-500 hover:text-zinc-300"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {screenshots.length < 3 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 rounded border border-dashed border-zinc-700 px-2 py-1 text-[10px] text-zinc-500 hover:border-zinc-500 hover:text-zinc-400"
                      >
                        <span>📁</span> Upload
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Auto-captured context */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                  <p className="text-[9px] text-zinc-600">
                    Auto-captured: <span className="text-zinc-500">{pageUrl}</span>
                    {typeof window !== 'undefined' && (
                      <> · {window.innerWidth}×{window.innerHeight}</>
                    )}
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-[10px] text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-amber-600 px-5 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
