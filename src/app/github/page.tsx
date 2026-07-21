import Image from "next/image";
import { redirect } from "next/navigation";
import { Star, GitFork } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GithubAnalyzerForm } from "@/components/github/github-analyzer-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Code2 } from "lucide-react";
import { RoadmapChangeBanner } from "@/components/roadmap/roadmap-change-banner";
import type { GitHubEvidenceBundle } from "@/lib/github/client";
import type { GithubAnalysis } from "@/lib/validations/github";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-medium text-cyan-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const EVIDENCE_LABEL: Record<string, { label: string; className: string }> = {
  demonstrated: { label: "Demonstrated", className: "bg-emerald-400/10 text-emerald-300" },
  assessed: { label: "Assessed", className: "bg-cyan-300/10 text-cyan-200" },
  inferred: { label: "Inferred", className: "bg-amber-400/10 text-amber-200" },
  claimed: { label: "Claimed", className: "bg-slate-700/50 text-slate-300" },
};

export default async function GithubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: githubProfile }, { data: studentSkills }, { data: latestGithubEvent }, { data: activeRoadmap }] = await Promise.all([
    supabase.from("github_profiles").select("username, profile_json, analysis_json, last_synced_at").eq("profile_id", user.id).maybeSingle(),
    supabase.from("student_skills").select("level, evidence_type, custom_skill_name, skills(name)").eq("profile_id", user.id),
    supabase
      .from("career_events")
      .select("payload_json, created_at")
      .eq("profile_id", user.id)
      .eq("event_type", "github.analyzed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("roadmaps").select("id").eq("profile_id", user.id).eq("status", "active").maybeSingle(),
  ]);

  let changeBanner: React.ReactNode = null;
  if (activeRoadmap) {
    const { data: latestChangeEvent } = await supabase
      .from("career_events")
      .select("payload_json, created_at")
      .eq("profile_id", user.id)
      .eq("event_type", "roadmap.changed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const payload = latestChangeEvent?.payload_json as
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
    if (payload && payload.roadmap_id === activeRoadmap.id) {
      changeBanner = (
        <RoadmapChangeBanner
          reason={payload.reason ?? ""}
          studentMessage={payload.student_message ?? ""}
          timelineChanges={payload.timeline_changes ?? ""}
          timelineDeltaWeeks={payload.timeline_delta_weeks ?? 0}
          affectedMilestones={payload.affected_milestones ?? []}
          preservedMilestones={payload.preserved_milestones ?? []}
          readinessScore={payload.readiness_score ?? 0}
          previousReadinessScore={payload.previous_readiness_score ?? null}
          changedAt={latestChangeEvent!.created_at}
        />
      );
    }
  }

  const bundle = githubProfile?.profile_json as GitHubEvidenceBundle | undefined;
  const analysis = githubProfile?.analysis_json as GithubAnalysis | undefined;
  const eventPayload = latestGithubEvent?.payload_json as
    | { readiness_delta?: number; new_demonstrated_skills?: string[] }
    | undefined;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="animate-fade-in-up">
          <p className="text-sm font-medium text-cyan-200">GitHub evidence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Prove your skills with real repositories</h1>
          <p className="mt-2 text-slate-400">
            We analyze your public repos as a second evidence source alongside your resume — no OAuth required.
          </p>
        </div>

        <GithubAnalyzerForm existingUsername={githubProfile?.username} />

        {!bundle && !analysis && (
          <EmptyState
            icon={Code2}
            title="No GitHub connected"
            description="Enter your username above to turn your public repositories into skill evidence."
          />
        )}

        {changeBanner}

        {bundle && analysis && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Profile">
                <div className="flex items-center gap-3">
                  <Image
                    src={bundle.profile.avatarUrl}
                    alt={bundle.profile.username}
                    width={48}
                    height={48}
                    className="rounded-full"
                    unoptimized
                  />
                  <div>
                    <p className="font-medium text-slate-100">{bundle.profile.name ?? bundle.profile.username}</p>
                    <p className="text-sm text-slate-400">@{bundle.profile.username}</p>
                  </div>
                </div>
                {bundle.profile.bio && <p className="mt-3 text-sm text-slate-300">{bundle.profile.bio}</p>}
                <p className="mt-3 text-xs text-slate-500">
                  {bundle.profile.publicRepos} public repos · {bundle.profile.followers} followers · synced{" "}
                  {githubProfile?.last_synced_at ? new Date(githubProfile.last_synced_at).toLocaleString() : "just now"}
                </p>
              </Section>
              <Section title="Readiness improvement">
                <p className="text-3xl font-semibold text-slate-100">
                  {eventPayload?.readiness_delta != null && eventPayload.readiness_delta !== 0
                    ? `${eventPayload.readiness_delta > 0 ? "+" : ""}${eventPayload.readiness_delta}%`
                    : "No change"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {eventPayload?.new_demonstrated_skills?.length
                    ? `${eventPayload.new_demonstrated_skills.length} skill(s) newly demonstrated: ${eventPayload.new_demonstrated_skills.join(", ")}`
                    : "No new demonstrated skills from this sync."}
                </p>
              </Section>
            </div>

            <Section title="Summary">
              <p className="text-sm leading-6 text-slate-200">{analysis.summary}</p>
            </Section>

            <Section title="Top repositories">
              <div className="grid gap-3 sm:grid-cols-2">
                {analysis.strongest_projects.map((project) => (
                  <div key={project.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                    <p className="font-medium text-slate-100">{project.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{project.description}</p>
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                      {project.highlights.map((highlight) => (
                        <li key={highlight}>· {highlight}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Skill evidence">
              <div className="space-y-3">
                {analysis.demonstrated_skills.map((skill) => (
                  <div key={skill.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{skill.name}</span>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                        Demonstrated · {skill.confidence}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Evidence: {skill.repositories.join(", ")}</p>
                  </div>
                ))}
                {analysis.inferred_skills.map((skill) => (
                  <div key={skill.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{skill.name}</span>
                      <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">Inferred</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{skill.reason}</p>
                  </div>
                ))}
              </div>
            </Section>

            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Missing portfolio areas">
                <ul className="space-y-1.5 text-sm text-slate-300">
                  {analysis.missing_portfolio_areas.map((area) => (
                    <li key={area}>· {area}</li>
                  ))}
                  {analysis.missing_portfolio_areas.length === 0 && <p className="text-sm text-slate-400">None identified.</p>}
                </ul>
              </Section>
              <Section title="Role fit adjustments">
                <ul className="space-y-1.5 text-sm text-slate-300">
                  {analysis.recommended_role_adjustments.map((note) => (
                    <li key={note}>· {note}</li>
                  ))}
                </ul>
              </Section>
            </div>

            <Section title="Claimed vs. demonstrated (all tracked skills)">
              <div className="flex flex-wrap gap-2">
                {(studentSkills ?? []).map((skill) => {
                  const name = skill.custom_skill_name ?? (skill.skills as unknown as { name: string } | null)?.name;
                  if (!name) return null;
                  const meta = EVIDENCE_LABEL[skill.evidence_type] ?? EVIDENCE_LABEL.claimed;
                  return (
                    <span key={name} className={`rounded-full px-2.5 py-1 text-xs ${meta.className}`}>
                      {name} · {meta.label}
                    </span>
                  );
                })}
              </div>
            </Section>

            <Section title="Repositories analyzed">
              <div className="grid gap-2 sm:grid-cols-2">
                {bundle.repositories.map((repo) => (
                  <div key={repo.name} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
                    <span className="text-slate-200">{repo.name}</span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star className="size-3" aria-hidden="true" /> {repo.stars}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="size-3" aria-hidden="true" /> {repo.forks}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
