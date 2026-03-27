'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const DEMO_ACCOUNTS: Record<string, { email: string; password: string }> = {
  gc: { email: 'demo-gc@readyboard.ai', password: 'ReadyBoard2026!' },
  sub: { email: 'demo-sub@readyboard.ai', password: 'ReadyBoard2026!' },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-login for demo accounts (?demo=gc or ?demo=sub)
  useEffect(() => {
    const demoKey = searchParams.get('demo');
    if (demoKey && DEMO_ACCOUNTS[demoKey]) {
      const { email: demoEmail, password: demoPassword } = DEMO_ACCOUNTS[demoKey];
      setEmail(demoEmail);
      setPassword(demoPassword);
      setLoading(true);
      const supabase = createClient();
      supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword }).then(({ error: err }) => {
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        router.replace('/dashboard');
        router.refresh();
      });
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-emerald-400 hover:text-emerald-300">
          Sign up
        </Link>
      </p>
    </form>
  );
}
