import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInterviewQuestions, type PrioritySkillGap } from "@/lib/agents/interview-agent";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import type { CareerTwinSkillRow, SkillGapMatrix } from "@/lib/career/skill-gap";
import type { InterviewDifficulty } from "@/lib/validations/interview";

const MAX_PRIORITY_GAPS = 5;

function deriveDifficulty(readinessScore: number): InterviewDifficulty {
  if (readinessScore < 40) return "beginner";
  if (readinessScore < 75) return "intermediate";
  return "advanced";
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: careerTwin } = await supabase
    .from("career_twins")
    .select("current_skills, current_readiness_score")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!careerTwin) {
    return NextResponse.json({ error: "Complete onboarding before starting an interview." }, { status: 400 });
  }

  const { data: goal } = await supabase
    .from("career_goals")
    .select("target_role")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!goal) {
    return NextResponse.json({ error: "Set a career goal before starting an interview." }, { status: 400 });
  }

  const { data: activeRoadmap } = await supabase
    .from("roadmaps")
    .select("id, skill_gap_snapshot")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  let skillGap: SkillGapMatrix;
  if (activeRoadmap?.skill_gap_snapshot) {
    skillGap = activeRoadmap.skill_gap_snapshot as SkillGapMatrix;
  } else {
    const careerTwinSkills = (careerTwin.current_skills as CareerTwinSkillRow[] | null) ?? [];
    const gapResult = await loadSkillGapContext(supabase, user.id, goal.target_role, careerTwinSkills);
    if (!gapResult.ok) {
      return NextResponse.json({ error: gapResult.error }, { status: 400 });
    }
    skillGap = gapResult.context.skillGap;
  }

  const prioritySkillGaps: PrioritySkillGap[] = [...skillGap]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_PRIORITY_GAPS)
    .map((entry) => ({ skill: entry.skill, required: entry.required, current: entry.current, priority: entry.priority }));

  if (!prioritySkillGaps.length) {
    return NextResponse.json({ error: "No skill gap data available yet. Generate a roadmap first." }, { status: 400 });
  }

  const [{ data: completedProjectRows }, { data: githubProfile }, { data: latestResume }] = await Promise.all([
    supabase.from("projects").select("title, project_json").eq("profile_id", user.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(5),
    supabase.from("github_profiles").select("analysis_json").eq("profile_id", user.id).maybeSingle(),
    supabase.from("resumes").select("analysis_json").eq("profile_id", user.id).not("analysis_json", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const completedProjects = (completedProjectRows ?? []).map((project) => ({
    title: project.title,
    skills: ((project.project_json as { skills?: string[] } | null)?.skills ?? []) as string[],
  }));
  const githubSummary = (githubProfile?.analysis_json as { summary?: string } | null)?.summary ?? null;
  const resumeSummary = (latestResume?.analysis_json as { summary?: string } | null)?.summary ?? null;

  const readinessScore = careerTwin.current_readiness_score ?? 0;
  const difficulty = deriveDifficulty(readinessScore);

  let questions;
  try {
    questions = await generateInterviewQuestions({
      targetRole: goal.target_role,
      difficulty,
      readinessScore,
      prioritySkillGaps,
      completedProjects,
      githubSummary,
      resumeSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate interview questions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: session, error: insertError } = await supabase
    .from("interview_sessions")
    .insert({
      profile_id: user.id,
      roadmap_id: activeRoadmap?.id ?? null,
      target_role: goal.target_role,
      difficulty,
      status: "in_progress",
      questions_json: questions,
      answers_json: [],
    })
    .select("id, created_at")
    .single();
  if (insertError || !session) {
    return NextResponse.json({ error: insertError?.message ?? "Could not start the interview." }, { status: 500 });
  }

  return NextResponse.json({ interviewId: session.id, targetRole: goal.target_role, difficulty, questions });
}
