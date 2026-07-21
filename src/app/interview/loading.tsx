import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function InterviewLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-full max-w-md" />
        <SkeletonCard lines={2} />
      </div>
    </main>
  );
}
