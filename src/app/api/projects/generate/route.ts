import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProjectPlan, type PrioritySkillGap } from "@/lib/agents/project-coach";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import type { CareerTwinSkillRow, SkillGapMatrix } from "@/lib/career/skill-gap";

const MAX_PRIORITY_GAPS = 5;

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
    return NextResponse.json({ error: "Complete onboarding before generating a project." }, { status: 400 });
  }

  const { data: goal } = await supabase
    .from("career_goals")
    .select("target_role, learning_style")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!goal) {
    return NextResponse.json({ error: "Set a career goal before generating a project." }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("weekly_hours").eq("id", user.id).single();

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
    .map((entry) => ({ skill: entry.skill, required: entry.required, current: entry.current, gap: entry.gap, priority: entry.priority }));

  if (!prioritySkillGaps.length) {
    return NextResponse.json({ error: "No skill gap data available yet. Generate a roadmap first." }, { status: 400 });
  }

  const { data: recentProjects } = await supabase
    .from("projects")
    .select("title, project_json")
    .eq("profile_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(5);
  const recentCompletedProjects = (recentProjects ?? []).map((project) => ({
    title: project.title,
    skills: ((project.project_json as { skills?: string[] } | null)?.skills ?? []) as string[],
  }));

  let plan;
  try {
    plan = await generateProjectPlan({
      targetRole: goal.target_role,
      readinessScore: careerTwin.current_readiness_score ?? 0,
      learningStyle: goal.learning_style,
      weeklyHours: profile?.weekly_hours ?? null,
      prioritySkillGaps,
      recentCompletedProjects,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      profile_id: user.id,
      roadmap_id: activeRoadmap?.id ?? null,
      title: plan.title,
      target_role: goal.target_role,
      difficulty: plan.difficulty,
      estimated_hours: plan.estimated_hours,
      status: "planned",
      project_json: plan,
    })
    .select("id, created_at")
    .single();
  if (insertError || !project) {
    return NextResponse.json({ error: insertError?.message ?? "Could not save the generated project." }, { status: 500 });
  }

  return NextResponse.json({ projectId: project.id, createdAt: project.created_at, plan });
}
