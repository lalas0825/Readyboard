'use client';

import type { ProjectSettings } from '../services/fetchProjectSettings';

type Props = {
  settings: ProjectSettings;
};

export function LegalSection({ settings }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Legal Configuration</h2>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          Settings for NOD, REA, and Evidence Package generation.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
        {/* Current Config (read-only summary) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium text-zinc-500">Jurisdiction</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-200">{settings.jurisdiction}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-zinc-500">SHA-256 Hashing</p>
            <p className={`mt-0.5 text-xs font-medium ${settings.sha256Enabled ? 'text-green-400' : 'text-zinc-500'}`}>
              {settings.sha256Enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Thresholds */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">NOD Thresholds</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] text-zinc-500">Auto-Draft Trigger</p>
              <p className="text-sm font-bold text-zinc-200">24 hours</p>
              <p className="text-[10px] text-zinc-600">blocked duration</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] text-zinc-500">REA Cost Threshold</p>
              <p className="text-sm font-bold text-zinc-200">$5,000</p>
              <p className="text-[10px] text-zinc-600">cumulative cost</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] text-zinc-500">REA Crew-Day Threshold</p>
              <p className="text-sm font-bold text-zinc-200">3 days</p>
              <p className="text-[10px] text-zinc-600">crew-days blocked</p>
            </div>
          </div>
        </div>

        {/* Document Templates */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Document Templates</p>
          <div className="mt-2 space-y-2">
            {['Notice of Delay (NOD)', 'Request for Equitable Adjustment (REA)', 'Evidence Package'].map((doc) => (
              <div key={doc} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <span className="text-xs text-zinc-300">{doc}</span>
                <span className="rounded bg-green-950/30 border border-green-900/50 px-1.5 py-0.5 text-[10px] text-green-400">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded bg-zinc-800/50 p-3">
          <p className="text-[10px] text-zinc-500">
            Threshold values and document templates are configured per jurisdiction.
            Custom thresholds will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
