import { Zap } from "lucide-react";

export interface RoadmapChangeBannerProps {
  reason: string;
  studentMessage: string;
  timelineChanges: string;
  timelineDeltaWeeks: number;
  affectedMilestones: string[];
  preservedMilestones: string[];
  readinessScore: number;
  previousReadinessScore: number | null;
  changedAt: string;
}

function formatDelay(weeks: number): string {
  if (weeks === 0) return "No change to your timeline";
  if (weeks < 0) return `Compressed by about ${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? "" : "s"}`;
  return `Extended by about ${weeks} week${weeks === 1 ? "" : "s"}`;
}

export function RoadmapChangeBanner({
  reason,
  studentMessage,
  timelineChanges,
  timelineDeltaWeeks,
  affectedMilestones,
  preservedMilestones,
  readinessScore,
  previousReadinessScore,
  changedAt,
}: RoadmapChangeBannerProps) {
  const scoreDelta = previousReadinessScore != null ? readinessScore - previousReadinessScore : null;

  return (
    <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
      <div className="flex items-center gap-2 text-amber-200">
        <Zap className="size-4" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Roadmap updated · {new Date(changedAt).toLocaleDateString()}</h2>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-200">{studentMessage}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reason</p>
          <p className="mt-1 text-sm text-slate-300">{reason}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Expected impact</p>
          <p className="mt-1 text-sm text-slate-300">{timelineChanges}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">What changed</p>
          {affectedMilestones.length ? (
            <ul className="mt-1 space-y-0.5 text-sm text-slate-300">
              {affectedMilestones.map((title) => (
                <li key={title}>· {title}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Full roadmap regenerated</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">What stayed the same</p>
          {preservedMilestones.length ? (
            <ul className="mt-1 space-y-0.5 text-sm text-slate-300">
              {preservedMilestones.map((title) => (
                <li key={title}>· {title}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Nothing completed yet to preserve</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-amber-400/20 pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Estimated delay</p>
          <p className="mt-1 text-sm text-slate-200">{formatDelay(timelineDeltaWeeks)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">New readiness score</p>
          <p className="mt-1 text-sm text-slate-200">
            {readinessScore}%
            {scoreDelta != null && scoreDelta !== 0 && (
              <span className={scoreDelta > 0 ? "text-emerald-300" : "text-rose-300"}>
                {" "}
                ({scoreDelta > 0 ? "+" : ""}
                {scoreDelta})
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
