'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore, type InviteEntry } from '../store/useOnboardingStore';
import { completeOnboarding } from '../services/completeOnboarding';

const ROLES = [
  { value: 'gc_pm', label: 'Project Manager' },
  { value: 'gc_super', label: 'Superintendent' },
  { value: 'foreman', label: 'Foreman' },
] as const;

export function StepTeam() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { invites, addInvite, removeInvite, prevStep, isSubmitting, setIsSubmitting } = store;

  const [inviteRole, setInviteRole] = useState<InviteEntry['role']>('gc_pm');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAddInvite() {
    if (inviteRole === 'foreman') {
      if (!invitePhone.trim()) return;
      addInvite({ phone: invitePhone.trim(), role: 'foreman' });
      setInvitePhone('');
    } else {
      if (!inviteEmail.trim()) return;
      addInvite({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
    }
  }

  async function handleFinish() {
    setError(null);
    setIsSubmitting(true);

    const enabledTrades = store.trades
      .filter((t) => t.enabled)
      .map((t, i) => ({ trade_name: t.trade_name, sequence_order: i + 1 }));

    const result = await completeOnboarding({
      orgName: store.org.name,
      orgLanguage: store.org.language,
      projectName: store.project.name || undefined,
      projectAddress: store.project.address || undefined,
      laborRate: store.project.laborRate,
      jurisdiction: store.project.jurisdiction,
      trades: enabledTrades.length > 0 ? enabledTrades : undefined,
      areas: store.areas.length > 0 ? store.areas : undefined,
      invites: invites.length > 0 ? invites : undefined,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    store.reset();
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Invite Your Team</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Add project managers, superintendents, and foremen. You can always invite more later.
        </p>
      </div>

      {/* Add invite form */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InviteEntry['role'])}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {inviteRole === 'foreman' ? (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Phone</label>
              <input
                type="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="pm@company.com"
                className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleAddInvite}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* Invite list */}
      {invites.length > 0 && (
        <div className="space-y-1">
          {invites.map((inv, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                  {inv.role.replace('gc_', '')}
                </span>
                <span className="text-sm text-zinc-200">
                  {inv.email || inv.phone}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeInvite(i)}
                className="text-zinc-600 hover:text-red-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={prevStep}
          disabled={isSubmitting}
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex gap-3">
          {invites.length === 0 && (
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Finishing...' : 'Skip & Finish'}
            </button>
          )}
          <button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Setting up...' : 'Finish Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}
