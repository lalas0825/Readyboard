import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ─── Navbar ────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/readyboard-icon-animated.svg" alt="" className="h-7 w-7" />
            <span className="text-base font-bold text-zinc-100">Ready</span>
            <span className="text-base font-light text-zinc-500">Board</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-zinc-300 transition-colors hover:text-white">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ──────────────────────────────── */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-aerial.jpg"
            alt="NYC high-rise construction site with ReadyBoard floor status overlay"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
        </div>

        {/* Content on top */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-block rounded-full border border-amber-400/30 bg-black/40 px-4 py-1.5 text-xs font-medium text-amber-400 backdrop-blur-sm">
            Built for foremen. Trusted by GCs.
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Your jobsite under control.{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              No calls. No chaos.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-300">
            ReadyBoard tells every trade what areas they can work today, alerts when something changes,
            and auto-documents every lost day as legal evidence.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="rounded-xl bg-amber-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-amber-600/20 transition-all hover:bg-amber-500 hover:shadow-amber-500/30"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login?demo=gc"
              className="rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Social Proof ─────────────────────── */}
      <section className="border-y border-zinc-800/50 bg-zinc-900/30 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-3xl font-extrabold text-amber-400">40h</p>
              <p className="mt-1 text-sm text-zinc-500">saved per week in GC management</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-amber-400">$0</p>
              <p className="mt-1 text-sm text-zinc-500">lost to undocumented delays</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-amber-400">60s</p>
              <p className="mt-1 text-sm text-zinc-500">morning update per foreman</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Two products. One platform.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            The GC buys for operational visibility. The specialty contractor stays for legal protection.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {/* GC Dashboard */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-950/50 text-2xl">
              &#128200;
            </div>
            <h3 className="text-xl font-bold">GC Dashboard</h3>
            <p className="mt-2 text-sm text-zinc-400">
              1-screen overview. Ready Board grid. Verification queue.
              See which trades are ready, blocked, or waiting on inspection — before the morning meeting.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-500">
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Ready Board grid (420+ areas)</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Delay cost counter (real-time)</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Forecast engine (P6 import)</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Corrective action Kanban</li>
            </ul>
          </div>

          {/* Legal Engine */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-950/50 text-2xl">
              &#9878;
            </div>
            <h3 className="text-xl font-bold">Legal Evidence Engine</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Auto-generates Notices of Delay, REAs, and Evidence Packages with SHA-256 hashing.
              Every lost day documented, every receipt tracked.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-500">
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> NOD auto-draft (24h trigger)</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> SHA-256 tamper verification</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Receipt tracking pixel</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Arbitration-ready evidence</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Carlos Standard ──────────────────── */}
      <section className="border-y border-zinc-800/50 bg-zinc-900/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-4 inline-block rounded-full border border-blue-800/50 bg-blue-950/20 px-3 py-1 text-xs font-medium text-blue-400">
                Mobile App
              </div>
              <h2 className="text-3xl font-bold">Built for the crew.</h2>
              <p className="mt-4 text-zinc-400">
                Your team reports from the field in 3 taps — no training, no WiFi, no waiting.
                ReadyBoard works the way your crew already does: fast, simple, done.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                <li className="flex gap-3"><span className="text-amber-400 font-bold">1.</span> One job per screen</li>
                <li className="flex gap-3"><span className="text-amber-400 font-bold">2.</span> Color does the talking</li>
                <li className="flex gap-3"><span className="text-amber-400 font-bold">3.</span> Maximum 3 taps</li>
                <li className="flex gap-3"><span className="text-amber-400 font-bold">4.</span> Big buttons, large text</li>
                <li className="flex gap-3"><span className="text-amber-400 font-bold">5.</span> Loud confirmation (haptic)</li>
                <li className="flex gap-3"><span className="text-amber-400 font-bold">6.</span> Offline is invisible</li>
              </ul>
            </div>
            <div className="mx-auto w-64 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="rounded-2xl bg-[#0f172a] p-4 text-center">
                <p className="text-2xl font-bold text-green-400">READY</p>
                <p className="mt-1 text-xs text-zinc-500">Bath 21A - Tile / Stone</p>
                <div className="mt-3 h-2 w-full rounded-full bg-zinc-800">
                  <div className="h-full w-4/5 rounded-full bg-green-500" />
                </div>
                <p className="mt-1 text-xs text-zinc-600">80%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Simple pricing. No per-user fees.</h2>
          <p className="mt-2 text-zinc-400">GCs think in project costs, not seats.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <PricingCard
            name="Starter"
            price="$399"
            description="For GC small projects"
            features={['Ready Board', 'Field reports', 'Delay logs', 'Basic forecast']}
            cta="Start Free Trial"
            href="/signup"
          />
          <PricingCard
            name="Pro"
            price="$699"
            description="For serious GCs"
            features={['Everything in Starter', 'Legal docs + SHA-256', 'Checklist mode', 'Schedule import', 'Verification queue']}
            cta="Start Free Trial"
            href="/signup"
            popular
          />
          <PricingCard
            name="Portfolio"
            price="$1,999"
            description="For multi-project GCs"
            features={['Everything in Pro', 'Unlimited projects', 'AI Morning Briefing', 'Enterprise API access', 'Audit logs + integrations']}
            cta="Contact Sales"
            href="mailto:sales@readyboard.ai?subject=Portfolio%20Plan%20Inquiry"
            enterprise
          />
          <PricingCard
            name="Sub Add-on"
            price="$59"
            description="For specialty contractors"
            features={['Legal docs + NODs', 'Delay cost tracking', 'Evidence packages', 'Field reports']}
            cta="Start Free Trial"
            href="/signup/sub"
          />
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────── */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/30 py-20 text-center">
        <div className="mx-auto max-w-xl px-6">
          <h2 className="text-3xl font-bold">Ready to take control?</h2>
          <p className="mt-4 text-zinc-400">
            30-day free trial. No credit card required. Set up your first project in 5 minutes.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-xl bg-amber-600 px-10 py-4 text-base font-bold text-white shadow-lg shadow-amber-600/20 transition-all hover:bg-amber-500"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────── */}
      <footer className="border-t border-zinc-800 py-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/readyboard-icon-static.svg" alt="" className="h-5 w-5 opacity-50" />
            <span className="text-xs text-zinc-600">ReadyBoard v5.3</span>
          </div>
          <div className="flex gap-6 text-xs text-zinc-600">
            <Link href="/terms" className="hover:text-zinc-400">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-400">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─── Pricing Card ───────────────────────────────────

function PricingCard({
  name, price, description, features, cta, href, popular, enterprise,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
  enterprise?: boolean;
}) {
  const borderClass = enterprise
    ? 'border-yellow-600/40 bg-gradient-to-b from-yellow-950/20 to-zinc-900/50 shadow-lg shadow-yellow-900/10'
    : popular
      ? 'border-amber-700/50 bg-amber-950/10 shadow-lg shadow-amber-900/10'
      : 'border-zinc-800 bg-zinc-900/50';

  const buttonClass = enterprise
    ? 'bg-yellow-600 text-white hover:bg-yellow-500'
    : popular
      ? 'bg-amber-600 text-white hover:bg-amber-500'
      : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800';

  return (
    <div className={`relative rounded-2xl border p-8 ${borderClass}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-0.5 text-[10px] font-bold text-white">
          MOST POPULAR
        </div>
      )}
      {enterprise && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-600 px-3 py-0.5 text-[10px] font-bold text-white">
          ENTERPRISE
        </div>
      )}
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      <p className="mt-4">
        <span className="text-3xl font-extrabold">{price}</span>
        <span className="text-sm text-zinc-500">/mo</span>
      </p>
      <ul className="mt-6 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
            <span className={enterprise ? 'text-yellow-400' : 'text-green-400'}>&#10003;</span> {f}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition-colors ${buttonClass}`}
      >
        {cta}
      </Link>
    </div>
  );
}
