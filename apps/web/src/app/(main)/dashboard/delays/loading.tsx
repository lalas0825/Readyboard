function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800 ${className ?? ''}`} />;
}

export default function DelaysLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div>
        <Pulse className="h-6 w-40" />
        <Pulse className="mt-2 h-3 w-64" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
            <Pulse className="h-2.5 w-16" />
            <Pulse className="h-5 w-20" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Pulse className="h-8 w-28" />
        <Pulse className="h-8 w-28" />
        <Pulse className="h-8 w-28" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/80 p-3">
          <div className="flex gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Pulse key={i} className="h-3 w-16" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-zinc-800/50 p-3">
            <Pulse className="h-4 w-20" />
            <Pulse className="h-4 w-24" />
            <Pulse className="h-4 w-16" />
            <Pulse className="h-4 w-12" />
            <Pulse className="h-4 w-14" />
            <Pulse className="h-4 w-16" />
            <Pulse className="h-4 w-18" />
            <Pulse className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
