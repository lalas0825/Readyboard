'use client';

import { useState } from 'react';
import { updateProjectSettings } from '../services/updateProjectSettings';
import { toast } from 'sonner';
import type { ProjectSettings } from '../services/fetchProjectSettings';

type Props = {
  settings: ProjectSettings;
};

const JURISDICTIONS = ['NY', 'FL', 'IL', 'TX', 'CA', 'NJ', 'PA', 'OH', 'GA', 'NC'];

export function GeneralSection({ settings }: Props) {
  const [name, setName] = useState(settings.name);
  const [address, setAddress] = useState(settings.address ?? '');
  const [laborRate, setLaborRate] = useState(String(settings.laborRate));
  const [jurisdiction, setJurisdiction] = useState(settings.jurisdiction);
  const [safetyGate, setSafetyGate] = useState(settings.safetyGateEnabled);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    name !== settings.name ||
    address !== (settings.address ?? '') ||
    laborRate !== String(settings.laborRate) ||
    jurisdiction !== settings.jurisdiction ||
    safetyGate !== settings.safetyGateEnabled;

  const handleSave = async () => {
    const rate = parseFloat(laborRate);
    if (isNaN(rate) || rate < 0) {
      toast.error('Labor rate must be a positive number.');
      return;
    }
    if (!name.trim()) {
      toast.error('Project name is required.');
      return;
    }

    setSaving(true);
    const result = await updateProjectSettings({
      projectId: settings.projectId,
      name: name.trim(),
      address: address.trim(),
      laborRate: rate,
      jurisdiction,
      safetyGateEnabled: safetyGate,
    });

    if (result.ok) {
      toast.success('Project settings saved.');
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">General</h2>
        <p className="mt-0.5 text-[10px] text-zinc-500">Project information and core configuration.</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
        {/* Organization */}
        <div>
          <label className="text-[10px] font-medium text-zinc-500">Organization</label>
          <p className="mt-0.5 text-xs text-zinc-300">{settings.orgName ?? 'N/A'}</p>
        </div>

        {/* Project Name */}
        <div>
          <label className="text-[10px] font-medium text-zinc-400">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-amber-600 focus:outline-none"
          />
        </div>

        {/* Address */}
        <div>
          <label className="text-[10px] font-medium text-zinc-400">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, New York, NY"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-600 focus:outline-none"
          />
        </div>

        {/* Labor Rate */}
        <div>
          <label className="text-[10px] font-medium text-zinc-400">Labor Rate ($/hour)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={laborRate}
            onChange={(e) => setLaborRate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-amber-600 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            Used for delay cost calculations. Changes apply to new cost computations immediately.
          </p>
        </div>

        {/* Jurisdiction */}
        <div>
          <label className="text-[10px] font-medium text-zinc-400">Legal Jurisdiction</label>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-amber-600 focus:outline-none"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        {/* Safety Gate */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-zinc-400">Safety Gate</p>
            <p className="text-[10px] text-zinc-600">Require safety clearance before trades can start work.</p>
          </div>
          <button
            onClick={() => setSafetyGate(!safetyGate)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              safetyGate ? 'bg-amber-600' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                safetyGate ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {hasChanges && (
          <span className="text-[10px] text-amber-400">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
