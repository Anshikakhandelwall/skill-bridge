import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function RoadmapLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-96" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </main>
  );
}
