export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-white/5" />
      <div className="mb-8 h-4 w-72 animate-pulse rounded bg-white/5" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    </div>
  );
}
