import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SkillGapEntry } from "@/lib/career/skill-gap";
import { GenerateRoadmapButton } from "@/components/roadmap/generate-roadmap-button";
import { RoadmapChangeBanner } from "@/components/roadmap/roadmap-change-banner";
import { SkillGapCard } from "@/components/roadmap/skill-gap-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Map as MapIcon } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="animate-fade-in-up rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-medium text-cyan-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function RoadmapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: twin } = await supabase
    .from("career_twins")
    .select("current_readiness_score, roadmap_status")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("id, readiness_score, version, summary, rationale, skill_gap_snapshot, created_at, goal_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!roadmap) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-cyan-200">Career roadmap</p>
          <EmptyState
            icon={MapIcon}
            title="No roadmap yet"
            description="Set a career goal and analyze your resume, then generate a milestone-based roadmap built from your actual skill gaps."
          >
            <div className="mt-5 flex justify-center">
              <GenerateRoadmapButton />
            </div>
          </EmptyState>
        </div>
      </main>
    );
  }

  const { data: goal } = await supabase
    .from("career_goals")
    .select("target_role")
    .eq("id", roadmap.goal_id)
    .maybeSingle();

  const { data: milestones } = await supabase
    .from("roadmap_milestones")
    .select("id, title, sequence, weeks_label, objective")
    .eq("roadmap_id", roadmap.id)
    .order("sequence", { ascending: true });

  const { data: tasks } = await supabase
    .from("roadmap_tasks")
    .select("id, milestone_id, title, description, evidence_required, why_it_matters, estimated_minutes, status")
    .eq("roadmap_id", roadmap.id);

  const tasksByMilestone = new Map<string, typeof tasks>();
  for (const task of tasks ?? []) {
    if (!task.milestone_id) continue;
    const bucket = tasksByMilestone.get(task.milestone_id) ?? [];
    bucket.push(task);
    tasksByMilestone.set(task.milestone_id, bucket);
  }

  const skillGap = (roadmap.skill_gap_snapshot as SkillGapEntry[] | null) ?? [];
  const readinessScore = twin?.current_readiness_score ?? roadmap.readiness_score;

  const { data: latestChangeEvent } = await supabase
    .from("career_events")
    .select("payload_json, created_at")
    .eq("profile_id", user.id)
    .eq("event_type", "roadmap.changed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const changePayload = latestChangeEvent?.payload_json as
    | {
        roadmap_id?: string;
        reason?: string;
        student_message?: string;
        timeline_changes?: string;
        timeline_delta_weeks?: number;
        affected_milestones?: string[];
        preserved_milestones?: string[];
        readiness_score?: number;
        previous_readiness_score?: number | null;
      }
    | undefined;
  const showChangeBanner = changePayload?.roadmap_id === roadmap.id;

  const { data: versionHistory } = await supabase
    .from("roadmaps")
    .select("id, version, status, readiness_score, summary, created_at")
    .eq("goal_id", roadmap.goal_id)
    .order("version", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-sm font-medium text-cyan-200">Career roadmap · {goal?.target_role ?? "Your goal"}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your path to {goal?.target_role ?? "your target role"}</h1>
            <p className="mt-2 text-slate-400">
              Version {roadmap.version} · generated {new Date(roadmap.created_at).toLocaleDateString()}
            </p>
          </div>
          <GenerateRoadmapButton label="Regenerate roadmap" />
        </div>

        {showChangeBanner && changePayload && (
          <RoadmapChangeBanner
            reason={changePayload.reason ?? ""}
            studentMessage={changePayload.student_message ?? ""}
            timelineChanges={changePayload.timeline_changes ?? ""}
            timelineDeltaWeeks={changePayload.timeline_delta_weeks ?? 0}
            affectedMilestones={changePayload.affected_milestones ?? []}
            preservedMilestones={changePayload.preserved_milestones ?? []}
            readinessScore={changePayload.readiness_score ?? readinessScore}
            previousReadinessScore={changePayload.previous_readiness_score ?? null}
            changedAt={latestChangeEvent!.created_at}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Career readiness score">
            <div className="flex items-center gap-4">
              <ProgressRing value={readinessScore} size={84} strokeWidth={7} />
              <p className="text-sm text-slate-400">Weighted by role importance and how well each skill is evidenced.</p>
            </div>
          </Section>
          <Section title="Summary">
            <p className="text-sm leading-6 text-slate-200">{roadmap.summary}</p>
          </Section>
        </div>

        <Section title="Skill gap">
          <div className="space-y-4">
            {skillGap.map((entry) => (
              <SkillGapCard key={entry.skill} entry={entry} />
            ))}
            {skillGap.length === 0 && <p className="text-sm text-slate-400">No skill gap data available.</p>}
          </div>
        </Section>

        {roadmap.rationale && (
          <Section title="Why this sequencing">
            <p className="text-sm leading-6 text-slate-300">{roadmap.rationale}</p>
          </Section>
        )}

        <div>
          <h2 className="text-lg font-semibold text-slate-100">Milestones</h2>
          <div className="mt-4 space-y-6">
            {(milestones ?? []).map((milestone) => (
              <div key={milestone.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    {milestone.sequence}. {milestone.title}
                  </h3>
                  <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                    {milestone.weeks_label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{milestone.objective}</p>

                <div className="mt-4 space-y-3">
                  {(tasksByMilestone.get(milestone.id) ?? []).map((task) => (
                    <div key={task.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-100">{task.title}</p>
                        <span className="text-xs text-slate-500">
                          ~{Math.round((task.estimated_minutes ?? 0) / 60)}h
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-300">{task.description}</p>
                      <p className="mt-2 text-sm text-slate-400">
                        <span className="font-medium text-slate-300">Why this matters: </span>
                        {task.why_it_matters}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        <span className="font-medium text-slate-300">Proof required: </span>
                        {task.evidence_required}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {versionHistory && versionHistory.length > 1 && (
          <Section title="Version history">
            <div className="space-y-2">
              {versionHistory.map((version) => (
                <div
                  key={version.id}
                  className={`rounded-lg border p-3 text-sm ${
                    version.id === roadmap.id ? "border-cyan-300/40 bg-cyan-300/5" : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-100">
                      v{version.version} {version.id === roadmap.id && <span className="text-cyan-200">(active)</span>}
                    </span>
                    <span className="text-xs text-slate-500">
                      {version.readiness_score}% · {new Date(version.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {version.summary && <p className="mt-1 text-slate-400">{version.summary}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}
