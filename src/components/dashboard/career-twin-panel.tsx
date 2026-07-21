import { CheckCircle2, TrendingUp, CircleDashed, FileText, Code2, FolderGit2, Mic } from "lucide-react";
import { AnimatedBar } from "@/components/ui/animated-bar";

export interface TwinSkill {
  name: string;
  level: number; // 0-5
  evidenceType: string; // claimed | inferred | assessed | demonstrated
}

export interface EvidenceSources {
  resume: boolean;
  github: boolean;
  completedProjects: number;
  completedInterviews: number;
}

const EVIDENCE_RANK: Record<string, number> = { claimed: 0, inferred: 1, assessed: 2, demonstrated: 3 };

function SkillChip({ skill }: { skill: TwinSkill }) {
  const pct = (skill.level / 5) * 100;
  const isDemonstrated = skill.evidenceType === "demonstrated";
  const isGrowing = skill.evidenceType === "assessed" || skill.evidenceType === "inferred";
  const barColor = isDemonstrated ? "bg-emerald-400" : isGrowing ? "bg-cyan-300" : "bg-slate-600";

  return (
    <div className="min-w-[9.5rem] rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 transition hover:border-cyan-300/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-200">{skill.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{skill.evidenceType}</span>
      </div>
      <div className="mt-1.5">
        <AnimatedBar value={pct} colorClassName={barColor} heightClassName="h-1.5" />
      </div>
    </div>
  );
}

function EvidenceSourceChip({ icon: Icon, label, connected, detail }: { icon: typeof FileText; label: string; connected: boolean; detail?: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        connected ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200" : "border-slate-800 bg-slate-950/60 text-slate-500"
      }`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="font-medium">{label}</span>
      {detail && <span className="text-slate-400">· {detail}</span>}
    </div>
  );
}

export function CareerTwinPanel({ skills, missingSkills, evidenceSources }: { skills: TwinSkill[]; missingSkills: string[]; evidenceSources: EvidenceSources }) {
  const demonstrated = skills.filter((s) => s.evidenceType === "demonstrated").sort((a, b) => b.level - a.level);
  const growing = skills
    .filter((s) => s.evidenceType === "assessed" || s.evidenceType === "inferred")
    .sort((a, b) => (EVIDENCE_RANK[b.evidenceType] ?? 0) - (EVIDENCE_RANK[a.evidenceType] ?? 0));
  const claimedOnly = skills.filter((s) => s.evidenceType === "claimed");

  return (
    <div className="animate-fade-in-up rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Your Career Twin</p>
          <p className="mt-1 text-xs text-slate-500">A living model of your skills, built from real evidence.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-300">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Demonstrated ({demonstrated.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {demonstrated.length ? demonstrated.map((s) => <SkillChip key={s.name} skill={s} />) : <p className="text-xs text-slate-500">None yet — upload evidence to prove a skill.</p>}
          </div>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-300">
            <TrendingUp className="size-3.5" aria-hidden="true" /> Growing ({growing.length + claimedOnly.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...growing, ...claimedOnly].length ? (
              [...growing, ...claimedOnly].map((s) => <SkillChip key={s.name} skill={s} />)
            ) : (
              <p className="text-xs text-slate-500">Nothing in progress yet.</p>
            )}
          </div>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-rose-300">
            <CircleDashed className="size-3.5" aria-hidden="true" /> Missing ({missingSkills.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingSkills.length ? (
              missingSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs text-rose-200">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-500">No known gaps right now.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Evidence sources</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <EvidenceSourceChip icon={FileText} label="Resume" connected={evidenceSources.resume} />
          <EvidenceSourceChip icon={Code2} label="GitHub" connected={evidenceSources.github} />
          <EvidenceSourceChip
            icon={FolderGit2}
            label="Projects"
            connected={evidenceSources.completedProjects > 0}
            detail={evidenceSources.completedProjects > 0 ? `${evidenceSources.completedProjects} completed` : undefined}
          />
          <EvidenceSourceChip
            icon={Mic}
            label="Interviews"
            connected={evidenceSources.completedInterviews > 0}
            detail={evidenceSources.completedInterviews > 0 ? `${evidenceSources.completedInterviews} completed` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
