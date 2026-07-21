import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { SmartNotifications } from "@/components/dashboard/smart-notifications";
import { buildSmartNotifications } from "@/lib/career/notifications";
import { DemoSimulationPanel } from "@/components/demo/demo-simulation-panel";
import { CareerTwinPanel, type TwinSkill } from "@/components/dashboard/career-twin-panel";
import { ProgressRing } from "@/components/ui/progress-ring";
import { LogoutButton } from "@/components/auth/logout-button";
import type { SkillGapEntry } from "@/lib/career/skill-gap";

async function getNextRecommendedAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  hasTwin: boolean,
  hasResume: boolean,
  roadmapStatus: string | undefined,
) {
  if (!hasTwin) return { label: "Complete onboarding", href: "/onboarding" };
  if (!hasResume) return { label: "Upload your resume", href: "/resume" };
  if (roadmapStatus !== "generated") return { label: "Generate your roadmap", href: "/roadmap" };

  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!roadmap) return { label: "Generate your roadmap", href: "/roadmap" };

  const { data: nextTask } = await supabase
    .from("roadmap_tasks")
    .select("title, roadmap_milestones!inner(sequence)")
    .eq("roadmap_id", roadmap.id)
    .eq("status", "pending")
    .order("sequence", { foreignTable: "roadmap_milestones", ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextTask) return { label: "Review your roadmap", href: "/roadmap" };
  return { label: `Next up: ${nextTask.title}`, href: "/roadmap" };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [
    profileResult,
    goalResult,
    skillsResult,
    twinResult,
    resumeResult,
    eventsResult,
    activeRoadmapResult,
    githubResult,
    projectResult,
    interviewResult,
    completedProjectsCountResult,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, weekly_hours").eq("id", user.id).single(),
    supabase.from("career_goals").select("target_role").eq("profile_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("student_skills").select("level, evidence_type, custom_skill_name, skills(name)").eq("profile_id", user.id),
    supabase.from("career_twins").select("current_readiness_score, roadmap_status, missing_skills").eq("profile_id", user.id).maybeSingle(),
    supabase.from("resumes").select("id").eq("profile_id", user.id).not("analysis_json", "is", null).limit(1).maybeSingle(),
    supabase.from("career_events").select("id, event_type, payload_json, created_at").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("roadmaps").select("skill_gap_snapshot").eq("profile_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("github_profiles").select("username, analysis_json, last_synced_at").eq("profile_id", user.id).maybeSingle(),
    supabase.from("projects").select("id, title, status, estimated_hours, project_json").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("interview_sessions").select("overall_score, feedback_json, created_at").eq("profile_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(10),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("profile_id", user.id).eq("status", "completed"),
  ]);

  const skillRows: TwinSkill[] = (skillsResult.data ?? [])
    .map((skill) => {
      const name = skill.custom_skill_name ?? (skill.skills as unknown as { name: string } | null)?.name;
      return name ? { name, level: skill.level, evidenceType: skill.evidence_type } : null;
    })
    .filter((skill): skill is TwinSkill => skill !== null);

  const hasTwin = Boolean(twinResult.data);
  const hasResume = Boolean(resumeResult.data);
  const nextAction = await getNextRecommendedAction(supabase, user.id, hasTwin, hasResume, twinResult.data?.roadmap_status);

  const events = eventsResult.data ?? [];
  const skillGap = (activeRoadmapResult.data?.skill_gap_snapshot as SkillGapEntry[] | null) ?? [];
  const topGap = [...skillGap].sort((a, b) => b.priority - a.priority)[0];
  const notifications = buildSmartNotifications(events, topGap ? { skill: topGap.skill, priority: topGap.priority } : undefined);

  const githubProfile = githubResult.data;
  const githubAnalysis = githubProfile?.analysis_json as { demonstrated_skills?: unknown[] } | null;
  const latestGithubEvent = events.find((event) => event.event_type === "github.analyzed");
  const githubReadinessDelta = (latestGithubEvent?.payload_json as { readiness_delta?: number } | undefined)?.readiness_delta;

  const currentProject = projectResult.data;
  const currentProjectPlan = currentProject?.project_json as { skills?: string[] } | null;
  const currentProjectProgress = currentProject?.status === "completed" ? 100 : 0;
  const weeklyHours = profileResult.data?.weekly_hours;
  const estimatedWeeks =
    currentProject && currentProject.status !== "completed" && weeklyHours
      ? Math.max(1, Math.ceil(currentProject.estimated_hours / weeklyHours))
      : null;

  const completedInterviews = interviewResult.data ?? [];
  const lastInterview = completedInterviews[0];
  const averageInterviewScore = completedInterviews.length
    ? Math.round(completedInterviews.reduce((sum, session) => sum + (session.overall_score ?? 0), 0) / completedInterviews.length)
    : null;
  const weakestCompetency = (() => {
    const evaluations = (lastInterview?.feedback_json as { skill_evaluations?: { skill: string; score: number }[] } | null)?.skill_evaluations ?? [];
    if (!evaluations.length) return null;
    return [...evaluations].sort((a, b) => a.score - b.score)[0].skill;
  })();
  const nextInterviewRecommendation = !lastInterview
    ? "Take your first mock interview"
    : weakestCompetency
      ? `Practice ${weakestCompetency} again`
      : "Keep up the practice";

  const readinessScore = twinResult.data?.current_readiness_score ?? 0;
  const missingSkills = (twinResult.data?.missing_skills as string[] | null) ?? [];
  const completedProjectsCount = completedProjectsCountResult.count ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="animate-fade-in-up flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-wide text-cyan-200">Career Twin dashboard</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {profileResult.data?.full_name ?? "student"}
            </h1>
            <p className="mt-2 max-w-xl text-slate-400">
              Every score here is backed by real evidence — resume, GitHub, projects, and interviews.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link href={nextAction.href} className="group hidden items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/10 sm:flex">
              <Rocket className="size-4" aria-hidden="true" />
              {nextAction.label}
              <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <LogoutButton />
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="animate-fade-in-up mt-6">
            <SmartNotifications notifications={notifications} />
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="animate-fade-in-up flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <ProgressRing value={readinessScore} label="Readiness" size={112} strokeWidth={9} />
            <Link href="/roadmap" className="text-xs font-medium text-cyan-200 hover:underline">
              View roadmap
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card label="Career goal" value={goalResult.data?.target_role ?? "Not set"} href="/onboarding" />
            <Card label="Resume status" value={hasResume ? "Analyzed" : "Not uploaded"} href="/resume" tone={hasResume ? "positive" : "neutral"} />
            <Card
              label="GitHub status"
              value={githubProfile ? `@${githubProfile.username}` : "Not connected"}
              detail={
                githubProfile
                  ? `${githubAnalysis?.demonstrated_skills?.length ?? 0} verified skills${githubReadinessDelta ? ` · ${githubReadinessDelta > 0 ? "+" : ""}${githubReadinessDelta}% readiness` : ""}`
                  : undefined
              }
              href="/github"
              tone={githubProfile ? "positive" : "neutral"}
            />
            <Card
              label="Current roadmap"
              value={twinResult.data?.roadmap_status === "generated" ? "Active" : "Not generated"}
              href="/roadmap"
              tone={twinResult.data?.roadmap_status === "generated" ? "positive" : "neutral"}
            />
            <Card
              label="Current project"
              value={currentProject ? currentProject.title : "None yet"}
              detail={
                currentProject
                  ? `${currentProjectProgress}% complete${estimatedWeeks ? ` · ~${estimatedWeeks}w left` : ""}${currentProjectPlan?.skills?.length ? ` · ${currentProjectPlan.skills.join(", ")}` : ""}`
                  : undefined
              }
              href="/projects"
              tone={currentProject?.status === "completed" ? "positive" : "neutral"}
            />
            <Card
              label="Interview readiness"
              value={lastInterview ? `Last: ${lastInterview.overall_score}%` : nextInterviewRecommendation}
              detail={lastInterview ? `Avg ${averageInterviewScore}%${weakestCompetency ? ` · Weakest: ${weakestCompetency}` : ""}` : undefined}
              href="/interview"
              tone={lastInterview && lastInterview.overall_score >= 70 ? "positive" : "neutral"}
            />
          </div>
        </div>

        <div className="mt-6">
          <CareerTwinPanel
            skills={skillRows}
            missingSkills={missingSkills}
            evidenceSources={{
              resume: hasResume,
              github: Boolean(githubProfile),
              completedProjects: completedProjectsCount,
              completedInterviews: completedInterviews.length,
            }}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="animate-fade-in-up rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm font-medium text-cyan-200">Activity timeline</p>
            <div className="mt-4">
              <ActivityTimeline events={events} />
            </div>
          </div>
          <div className="animate-fade-in-up rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm font-medium text-cyan-200">Try the Adaptive Career Engine</p>
            <div className="mt-4">
              <DemoSimulationPanel />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({
  label,
  value,
  detail,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  href: string;
  tone?: "positive" | "neutral";
}) {
  return (
    <Link
      href={href}
      className={`animate-fade-in-up group block h-full rounded-xl border bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-950/40 focus-visible:-translate-y-0.5 ${
        tone === "positive" ? "border-emerald-400/20 hover:border-emerald-400/50" : "border-slate-800 hover:border-cyan-300/50"
      }`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-slate-100">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </Link>
  );
}
