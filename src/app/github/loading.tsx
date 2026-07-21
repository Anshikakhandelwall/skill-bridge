import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function GithubLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-96" />
        <SkeletonCard lines={2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </main>
  );
}
