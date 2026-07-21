import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ResumeLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-2 h-4 w-full" />
        <div className="mt-8">
          <SkeletonCard lines={2} />
        </div>
      </div>
    </main>
  );
}
