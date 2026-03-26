'use client';

import { useState, useRef, useCallback } from 'react';
import { importP6Schedule } from '../services/importP6';
import { UpgradePrompt } from '@/features/billing/components/UpgradePrompt';
import { toast } from 'sonner';
import type { PlanId } from '@/lib/stripe';
import type { ImportResult } from '../types';
import type { ScheduleItemRow } from '../types';

// ─── Types ──────────────────────────────────────────

type Props = {
  projectId: string;
  planId: PlanId;
  existingItems: ScheduleItemRow[];
};

type PreviewRow = {
  activity_id: string;
  area_name: string;
  trade_name: string;
  planned_start: string;
  planned_finish: string;
  baseline_finish: string;
  is_critical: string;
};

// ─── Component ──────────────────────────────────────

export function ScheduleUpload({ projectId, planId, existingItems }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const isStarter = planId === 'starter';

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported. Export from P6 as CSV.');
      return;
    }
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);

      // Parse preview (first 10 rows)
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) {
        toast.error('CSV file appears empty.');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const rows: PreviewRow[] = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
        rows.push({
          activity_id: row['activity_id'] ?? '',
          area_name: row['area_name'] ?? '',
          trade_name: row['trade_name'] ?? '',
          planned_start: row['planned_start'] ?? '',
          planned_finish: row['planned_finish'] ?? '',
          baseline_finish: row['baseline_finish'] ?? '',
          is_critical: row['is_critical'] ?? '',
        });
      }
      setPreview(rows);
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleImport = async () => {
    if (!fileContent || !projectId) return;
    setImporting(true);
    try {
      const res = await importP6Schedule(projectId, fileContent, 'csv');
      setResult(res);
      if (res.success) {
        toast.success(`Imported ${res.upserted} schedule items (${res.critical} critical).`);
      } else {
        toast.error(res.error ?? 'Import failed.');
      }
    } catch {
      toast.error('Import failed unexpectedly.');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileContent(null);
    setPreview([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Starter plan gate
  if (isStarter) {
    return (
      <UpgradePrompt
        projectId={projectId}
        feature="Schedule Import"
        description="Import P6/CSV schedules, track baseline vs actual dates, and enable forecast projections."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Existing Schedule Summary ─────────── */}
      {existingItems.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-300">
                {existingItems.length} schedule items loaded
              </p>
              <p className="text-[10px] text-zinc-500">
                {existingItems.filter((i) => i.isCritical).length} critical path items
              </p>
            </div>
            <span className="rounded-full bg-green-950/30 border border-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">
              Active
            </span>
          </div>
        </div>
      )}

      {/* ─── Upload Dropzone ──────────────────── */}
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? 'border-amber-500 bg-amber-950/20'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <svg className="mx-auto h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="mt-2 text-sm text-zinc-400">
          {file ? file.name : 'Drop P6 CSV file here or click to browse'}
        </p>
        <p className="mt-1 text-[10px] text-zinc-600">
          Required columns: activity_id, area_name, trade_name, planned_start, planned_finish
        </p>
      </div>

      {/* ─── Preview Table ────────────────────── */}
      {preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-300">
              Preview ({preview.length} of {file ? '...' : '0'} rows)
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Clear
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {importing ? 'Importing...' : existingItems.length > 0 ? 'Update Schedule' : 'Import Schedule'}
              </button>
            </div>
          </div>

          {/* Validation warnings */}
          {preview.some((r) => !r.activity_id || !r.area_name || !r.trade_name) && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2">
              <p className="text-[10px] text-red-400">
                Some rows are missing required fields (activity_id, area_name, trade_name). These will cause import errors.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 font-medium text-zinc-400">Activity ID</th>
                  <th className="px-3 py-2 font-medium text-zinc-400">Area</th>
                  <th className="px-3 py-2 font-medium text-zinc-400">Trade</th>
                  <th className="px-3 py-2 font-medium text-zinc-400">Start</th>
                  <th className="px-3 py-2 font-medium text-zinc-400">Finish</th>
                  <th className="px-3 py-2 font-medium text-zinc-400">Baseline</th>
                  <th className="px-3 py-2 font-medium text-zinc-400 text-center">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {preview.map((row, i) => {
                  const missing = !row.activity_id || !row.area_name || !row.trade_name;
                  return (
                    <tr key={i} className={missing ? 'bg-red-950/10' : ''}>
                      <td className="px-3 py-2 font-mono text-zinc-300">{row.activity_id || <span className="text-red-400">--</span>}</td>
                      <td className="px-3 py-2 text-zinc-300">{row.area_name || <span className="text-red-400">--</span>}</td>
                      <td className="px-3 py-2 text-zinc-300">{row.trade_name || <span className="text-red-400">--</span>}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.planned_start || '--'}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.planned_finish || '--'}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.baseline_finish || '--'}</td>
                      <td className="px-3 py-2 text-center">
                        {(row.is_critical === 'true' || row.is_critical === '1') && (
                          <span className="text-amber-400">&#9889;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Import Result ────────────────────── */}
      {result && (
        <div className={`rounded-lg border p-4 ${
          result.success
            ? 'border-green-900/50 bg-green-950/20'
            : 'border-red-900/50 bg-red-950/20'
        }`}>
          {result.success ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-400">
                Import successful: {result.upserted} items ({result.critical} critical)
              </p>
              {result.unmappedAreas.length > 0 && (
                <div>
                  <p className="text-[10px] text-amber-400">
                    {result.unmappedAreas.length} unmapped areas (no matching area in project):
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {result.unmappedAreas.join(', ')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-400">{result.error}</p>
          )}
        </div>
      )}

      {/* ─── Existing Items Table ─────────────── */}
      {existingItems.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Current Schedule ({existingItems.length} items)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="pb-2 font-medium">Area</th>
                  <th className="pb-2 font-medium">Trade</th>
                  <th className="pb-2 text-right font-medium">Planned Finish</th>
                  <th className="pb-2 text-right font-medium">Baseline</th>
                  <th className="pb-2 text-center font-medium">Mapped</th>
                  <th className="pb-2 text-center font-medium">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {existingItems.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-zinc-300">{item.areaName}</td>
                    <td className="py-2 text-zinc-400">{item.tradeName}</td>
                    <td className="py-2 text-right text-zinc-400">
                      {item.plannedFinish ? new Date(item.plannedFinish).toLocaleDateString() : '--'}
                    </td>
                    <td className="py-2 text-right text-zinc-500">
                      {item.baselineFinish ? new Date(item.baselineFinish).toLocaleDateString() : '--'}
                    </td>
                    <td className="py-2 text-center">
                      {item.areaId ? (
                        <span className="text-green-400">&#10003;</span>
                      ) : (
                        <span className="text-amber-400" title="Area not mapped">?</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {item.isCritical && <span className="text-amber-400">&#9889;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {existingItems.length > 20 && (
              <p className="mt-2 text-center text-[10px] text-zinc-600">
                Showing 20 of {existingItems.length} items
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
