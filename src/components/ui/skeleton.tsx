export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-shimmer relative overflow-hidden rounded-md bg-slate-800/80 ${className}`}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
