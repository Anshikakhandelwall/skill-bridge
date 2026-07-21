import type { SkillGapEntry } from "@/lib/career/skill-gap";
import { AnimatedBar } from "@/components/ui/animated-bar";

const EVIDENCE_QUALITY: Record<string, { label: string; className: string }> = {
  demonstrated: { label: "Strong evidence", className: "bg-emerald-400/10 text-emerald-300" },
  assessed: { label: "Verified", className: "bg-cyan-300/10 text-cyan-200" },
  inferred: { label: "Weak signal", className: "bg-amber-400/10 text-amber-200" },
  claimed: { label: "Unverified", className: "bg-slate-700/50 text-slate-300" },
  none: { label: "No evidence", className: "bg-slate-800 text-slate-500" },
};

function statusFor(entry: SkillGapEntry): { label: string; dotClassName: string; barClassName: string } {
  if (entry.gap <= 0) return { label: "Closed", dotClassName: "bg-emerald-400", barClassName: "bg-emerald-400" };
  if (entry.priority >= 0.67) return { label: "Critical", dotClassName: "bg-rose-400", barClassName: "bg-rose-400" };
  if (entry.priority >= 0.34) return { label: "Needs work", dotClassName: "bg-amber-300", barClassName: "bg-amber-300" };
  return { label: "On track", dotClassName: "bg-cyan-300", barClassName: "bg-cyan-300" };
}

function LevelDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: max }).map((_, index) => (
        <span key={index} className={`size-1.5 rounded-full ${index < Math.round(value) ? "bg-slate-200" : "bg-slate-700"}`} />
      ))}
    </div>
  );
}

export function SkillGapCard({ entry }: { entry: SkillGapEntry }) {
  const status = statusFor(entry);
  const evidence = EVIDENCE_QUALITY[entry.evidenceType] ?? EVIDENCE_QUALITY.none;

  return (
    <div className="animate-fade-in-up rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-100">{entry.skill}</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
          <span className={`size-1.5 rounded-full ${status.dotClassName}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Required</p>
          <div className="mt-1">
            <LevelDots value={entry.required} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Current</p>
          <div className="mt-1">
            <LevelDots value={entry.effective} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Evidence</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${evidence.className}`}>{evidence.label}</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Priority</p>
          <p className="mt-1 text-xs text-slate-300">{Math.round(entry.priority * 100)}%</p>
        </div>
      </div>

      <div className="mt-3">
        <AnimatedBar value={(entry.effective / Math.max(entry.required, 1)) * 100} colorClassName={status.barClassName} heightClassName="h-1.5" />
      </div>
    </div>
  );
}
