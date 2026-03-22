import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/readyboard-lockup-dark.svg"
        alt="ReadyBoard"
        className="h-16"
      />
      <p className="mt-4 text-zinc-400">
        Legal infrastructure for commercial construction.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
      >
        Open Dashboard
      </Link>
    </main>
  )
}
