function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800 ${className ?? ''}`} />;
}

export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 p-4">
        <Pulse className="h-4 w-32" />
      </div>
      <div className="divide-y divide-zinc-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4">
            <Pulse className="h-4 w-24" />
            <Pulse className="h-4 w-32" />
            <Pulse className="h-4 flex-1" />
            <Pulse className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Pulse className="h-8 w-32" />
        <Pulse className="h-8 w-24" />
        <Pulse className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-6 gap-1 lg:grid-cols-14">
        {Array.from({ length: 84 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Pulse className="h-6 w-40" />
      <MetricsSkeleton />
      <TableSkeleton />
    </div>
  );
}
