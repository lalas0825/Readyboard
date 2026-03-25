'use client';

import { useOnboardingStore } from '../store/useOnboardingStore';

const JURISDICTIONS = [
  { value: 'NY', label: 'New York' },
  { value: 'FL', label: 'Florida' },
  { value: 'IL', label: 'Illinois' },
  { value: 'TX', label: 'Texas' },
  { value: 'CA', label: 'California' },
];

export function StepProject() {
  const { project, setProject, nextStep, prevStep } = useOnboardingStore();

  const canContinue = project.name.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">First Project</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Set up your first construction project. You can add more later.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-zinc-300">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            required
            value={project.name}
            onChange={(e) => setProject({ name: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="383 Madison Avenue"
          />
        </div>

        <div>
          <label htmlFor="project-address" className="block text-sm font-medium text-zinc-300">
            Address
          </label>
          <input
            id="project-address"
            type="text"
            value={project.address}
            onChange={(e) => setProject({ address: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="383 Madison Ave, New York, NY 10179"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="labor-rate" className="block text-sm font-medium text-zinc-300">
              Labor Rate ($/hr)
            </label>
            <input
              id="labor-rate"
              type="number"
              min={1}
              step={0.5}
              value={project.laborRate}
              onChange={(e) => setProject({ laborRate: parseFloat(e.target.value) || 85 })}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="jurisdiction" className="block text-sm font-medium text-zinc-300">
              Jurisdiction
            </label>
            <select
              id="jurisdiction"
              value={project.jurisdiction}
              onChange={(e) => setProject({ jurisdiction: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={prevStep}
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          disabled={!canContinue}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
