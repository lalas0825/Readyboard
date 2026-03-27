import Link from 'next/link';

export default function BillingSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-950/50 ring-2 ring-emerald-700">
          <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-zinc-100">You&apos;re all set!</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your subscription is now active. All Pro features are unlocked for your project.
        </p>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">What&apos;s unlocked</p>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Legal documents (NOD, REA, Evidence)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> SHA-256 verification &amp; receipt tracking
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Checklist mode &amp; GC verification queue
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Schedule import &amp; forecast engine
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Integrations &amp; audit logs
            </li>
          </ul>
        </div>

        <Link
          href="/dashboard"
          className="mt-8 inline-block w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
