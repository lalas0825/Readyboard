export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded bg-white/5" />
        <div className="h-8 w-64 animate-pulse rounded bg-white/5" />
      </div>
      <div className="mb-3 flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-16 animate-pulse rounded bg-white/5" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-white/5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex gap-2 border-b border-white/5 p-3">
            <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
            {Array.from({ length: 14 }).map((_, j) => (
              <div key={j} className="h-4 w-10 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
