import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCareerPlan } from "@/lib/agents/career-planner";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import type { CareerTwinSkillRow } from "@/lib/career/skill-gap";
import { recordCareerEvent } from "@/lib/career/events";

export type GenerateRoadmapResult =
  | { ok: true; roadmapId: string; version: number; readinessScore: number; milestoneCount: number; taskCount: number }
  | { ok: false; status: number; error: string };

/**
 * Generates a brand-new roadmap version for a profile's active career goal:
 * loads context, computes the skill gap + readiness score deterministically,
 * calls the Career Planner agent, persists the roadmap/milestones/tasks,
 * updates the Career Twin, and logs a roadmap.generated event.
 *
 * Used both by POST /api/roadmap/generate and by the adaptation engine when
 * an event (e.g. career_goal.changed) calls for a full regenerate rather
 * than a patch.
 */
export async function generateRoadmapForActiveGoal(
  supabase: SupabaseClient,
  profileId: string,
): Promise<GenerateRoadmapResult> {
  const { data: careerTwin } = await supabase
    .from("career_twins")
    .select("current_skills, career_goal_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!careerTwin) {
    return { ok: false, status: 400, error: "Complete onboarding before generating a roadmap." };
  }

  const { data: goal } = await supabase
    .from("career_goals")
    .select("id, target_role, target_date, learning_style")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!goal) {
    return { ok: false, status: 400, error: "Set a career goal before generating a roadmap." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("weekly_hours, workload_level")
    .eq("id", profileId)
    .single();

  const careerTwinSkills = (careerTwin.current_skills as CareerTwinSkillRow[] | null) ?? [];
  const gapResult = await loadSkillGapContext(supabase, profileId, goal.target_role, careerTwinSkills);
  if (!gapResult.ok) {
    return { ok: false, status: 400, error: gapResult.error };
  }
  const { skillGap, readinessScore } = gapResult.context;

  let plan;
  try {
    plan = await generateCareerPlan({
      targetRole: goal.target_role,
      targetDate: goal.target_date,
      weeklyHours: profile?.weekly_hours ?? null,
      workloadLevel: profile?.workload_level ?? null,
      learningStyle: goal.learning_style,
      readinessScore,
      skillGap,
      strengths: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roadmap generation failed.";
    return { ok: false, status: 502, error: message };
  }

  const { data: existingRoadmaps } = await supabase
    .from("roadmaps")
    .select("id, version")
    .eq("profile_id", profileId)
    .eq("goal_id", goal.id)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingRoadmaps?.[0]?.version ?? 0) + 1;

  await supabase
    .from("roadmaps")
    .update({ status: "archived" })
    .eq("profile_id", profileId)
    .eq("goal_id", goal.id)
    .neq("status", "archived");

  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .insert({
      profile_id: profileId,
      goal_id: goal.id,
      readiness_score: readinessScore,
      version: nextVersion,
      status: "active",
      skill_gap_snapshot: skillGap,
      summary: plan.summary,
      rationale: plan.rationale,
    })
    .select("id")
    .single();
  if (roadmapError || !roadmap) {
    return { ok: false, status: 500, error: roadmapError?.message ?? "Could not save the roadmap." };
  }

  const milestoneRows = plan.milestones.map((milestone, index) => ({
    roadmap_id: roadmap.id,
    title: milestone.title,
    sequence: index + 1,
    weeks_label: milestone.weeks,
    objective: milestone.objective,
  }));
  const { data: insertedMilestones, error: milestoneError } = await supabase
    .from("roadmap_milestones")
    .insert(milestoneRows)
    .select("id, sequence");
  if (milestoneError || !insertedMilestones) {
    return { ok: false, status: 500, error: milestoneError?.message ?? "Could not save roadmap milestones." };
  }
  const milestoneIdBySequence = new Map(insertedMilestones.map((row) => [row.sequence, row.id]));

  const { data: librarySkills } = await supabase.from("skills").select("id, name");
  const skillIdByName = new Map((librarySkills ?? []).map((skill) => [skill.name.toLowerCase(), skill.id]));
  const gapBySkillName = new Map(skillGap.map((entry) => [entry.skill.toLowerCase(), entry]));

  const taskRows = plan.milestones.flatMap((milestone, index) => {
    const milestoneId = milestoneIdBySequence.get(index + 1);
    return milestone.tasks.map((task) => {
      const gapEntry = gapBySkillName.get(task.skill.toLowerCase());
      const whyItMatters = gapEntry
        ? `Closes your gap in ${gapEntry.skill}: currently level ${gapEntry.current}/5 (${gapEntry.evidenceType}), target level ${gapEntry.required}/5 for ${goal.target_role}.`
        : `Builds a skill needed for ${goal.target_role}.`;
      return {
        roadmap_id: roadmap.id,
        milestone_id: milestoneId,
        title: task.title,
        skill_id: skillIdByName.get(task.skill.toLowerCase()) ?? null,
        estimated_minutes: Math.max(15, Math.round(task.estimated_hours * 60)),
        status: "pending",
        description: task.description,
        evidence_required: task.evidence_required,
        why_it_matters: whyItMatters,
      };
    });
  });

  const { error: taskError } = await supabase.from("roadmap_tasks").insert(taskRows);
  if (taskError) {
    return { ok: false, status: 500, error: taskError.message };
  }

  const now = new Date().toISOString();
  await supabase
    .from("career_twins")
    .update({ current_readiness_score: readinessScore, roadmap_status: "generated", updated_at: now })
    .eq("profile_id", profileId);

  await recordCareerEvent(supabase, profileId, "roadmap.generated", {
    roadmap_id: roadmap.id,
    version: nextVersion,
    readiness_score: readinessScore,
    milestone_count: plan.milestones.length,
    task_count: taskRows.length,
  });

  return {
    ok: true,
    roadmapId: roadmap.id,
    version: nextVersion,
    readinessScore,
    milestoneCount: plan.milestones.length,
    taskCount: taskRows.length,
  };
}
