'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { InviteTokenData } from '../services/validateInviteToken';

type Props = {
  invite: InviteTokenData;
};

/**
 * Join form shown when user clicks an invite link.
 * Creates account + redeems invite in one flow.
 */
export function JoinProjectForm({ invite }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSub = invite.role === 'sub_pm';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: invite.role,
          ...(isSub && orgName ? { org_name: orgName } : {}),
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // 2. Redeem invite token
    if (authData.user) {
      try {
        const res = await fetch('/api/invite/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: invite.token }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? 'Failed to join project.');
          setLoading(false);
          return;
        }
      } catch {
        setError('Failed to process invite.');
        setLoading(false);
        return;
      }
    }

    // 3. Redirect
    router.push('/login?confirmed=pending&joined=true');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Project info card */}
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4">
        <p className="text-xs text-emerald-400">You&apos;ve been invited to join</p>
        <p className="mt-1 text-lg font-semibold text-zinc-100">{invite.projectName}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          as {isSub ? 'Specialty Contractor (PM)' : 'Foreman'}
          {invite.areaName && ` — ${invite.areaName}`}
        </p>
      </div>

      {isSub && (
        <div>
          <label htmlFor="orgName" className="block text-sm font-medium text-zinc-300">
            Company Name
          </label>
          <input
            id="orgName"
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Acme Plumbing Co."
          />
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
          Full Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="Min. 6 characters"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Joining project...' : 'Create Account & Join'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}
