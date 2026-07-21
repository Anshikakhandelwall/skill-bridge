import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeProjectEvidenceIntoStudentSkills } from "@/lib/career/project-skill-merge";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import { adaptRoadmap } from "@/lib/career/orchestrator";
import { recordCareerEvent } from "@/lib/career/events";
import type { CareerTwinSkillRow } from "@/lib/career/skill-gap";
import type { ProjectPlan } from "@/lib/validations/project";

type CurrentSkill = { name: string; level: number; confidence?: number; evidence_type?: string };

/** Same never-downgrade merge pattern used by the resume and GitHub routes. */
function mergeCurrentSkillsWithProject(existing: CurrentSkill[], skills: string[]): CurrentSkill[] {
  const byName = new Map<string, CurrentSkill>();
  for (const skill of existing) {
    if (skill?.name) byName.set(skill.name.toLowerCase(), { ...skill });
  }
  for (const skillName of skills) {
    const key = skillName.toLowerCase();
    const prior = byName.get(key);
    byName.set(key, {
      name: prior?.name ?? skillName,
      level: Math.max(prior?.level ?? 0, 4),
      confidence: Math.max(prior?.confidence ?? 0, 85),
      evidence_type: "demonstrated",
    });
  }
  return Array.from(byName.values());
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const githubUrl = typeof body?.githubUrl === "string" && body.githubUrl.trim() ? body.githubUrl.trim() : null;

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("id, title, status, project_json")
    .eq("id", projectId)
    .eq("profile_id", user.id)
    .single();
  if (fetchError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.status === "completed") {
    return NextResponse.json({ error: "This project is already marked complete." }, { status: 409 });
  }

  const plan = project.project_json as ProjectPlan;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: "completed", completed_at: now, github_url: githubUrl })
    .eq("id", projectId)
    .eq("profile_id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { newlyDemonstrated } = await mergeProjectEvidenceIntoStudentSkills(supabase, user.id, plan.skills);

  const { data: careerTwin } = await supabase
    .from("career_twins")
    .select("current_skills, current_readiness_score")
    .eq("profile_id", user.id)
    .maybeSingle();

  const mergedSkills = mergeCurrentSkillsWithProject((careerTwin?.current_skills as CurrentSkill[] | null) ?? [], plan.skills);
  const previousReadinessScore = careerTwin?.current_readiness_score ?? 0;
  let readinessScore = previousReadinessScore;

  const { data: goal } = await supabase
    .from("career_goals")
    .select("target_role")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (goal) {
    const gapResult = await loadSkillGapContext(supabase, user.id, goal.target_role, mergedSkills as CareerTwinSkillRow[]);
    if (gapResult.ok) readinessScore = gapResult.context.readinessScore;
  }
  const readinessDelta = readinessScore - previousReadinessScore;

  await supabase
    .from("career_twins")
    .update({ current_skills: mergedSkills, current_readiness_score: readinessScore, updated_at: now })
    .eq("profile_id", user.id);

  await recordCareerEvent(supabase, user.id, "project.completed", {
    project_id: projectId,
    title: project.title,
    skills: plan.skills,
    newly_demonstrated: newlyDemonstrated,
    readiness_delta: readinessDelta,
    github_url: githubUrl,
  });

  const adaptation = await adaptRoadmap(supabase, user.id, { type: "project.completed", taskId: undefined });

  return NextResponse.json({
    projectId,
    readinessScore,
    previousReadinessScore,
    readinessDelta,
    newlyDemonstrated,
    adaptation,
  });
}
