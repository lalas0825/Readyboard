import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 py-20">
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">&larr; Back</Link>
        <h1 className="mt-6 text-3xl font-bold text-zinc-100">Terms of Service</h1>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>Last updated: March 2026</p>
          <p>ReadyBoard provides a legal infrastructure platform for commercial construction project management. By using our service, you agree to these terms.</p>
          <p>Full terms of service will be published before public launch. For questions, contact legal@readyboard.ai.</p>
        </div>
      </div>
    </main>
  );
}
