import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-9 w-80" />
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </main>
  );
}
