'use client';

import { useOnboardingStore } from '../store/useOnboardingStore';

export function StepOrganization() {
  const { org, setOrg, nextStep } = useOnboardingStore();

  const canContinue = org.name.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Your Organization</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Tell us about your company. You can update this later in settings.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-zinc-300">
            Company Name
          </label>
          <input
            id="org-name"
            type="text"
            required
            value={org.name}
            onChange={(e) => setOrg({ name: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Acme Construction"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Default Language
          </label>
          <div className="flex gap-3">
            {(['en', 'es'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setOrg({ language: lang })}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  org.language === lang
                    ? 'border-emerald-600 bg-emerald-950/30 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {lang === 'en' ? 'English' : 'Español'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
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
