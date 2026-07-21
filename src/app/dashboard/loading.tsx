import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-2 h-4 w-96" />
        <div className="mt-8 grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <Skeleton className="size-28 rounded-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} lines={1} />
            ))}
          </div>
        </div>
        <div className="mt-6">
          <SkeletonCard lines={5} />
        </div>
      </div>
    </main>
  );
}
