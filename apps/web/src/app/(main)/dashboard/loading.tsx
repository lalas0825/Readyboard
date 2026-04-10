export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-white/5" />
      <div className="mb-8 h-4 w-72 animate-pulse rounded bg-white/5" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
