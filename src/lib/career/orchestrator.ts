import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAdaptationPlan } from "@/lib/agents/adaptation-agent";
import { generateRoadmapForActiveGoal } from "@/lib/career/generate-roadmap";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import { planRoadmapChange, parseWeeksLabel, type AdaptationTrigger, type RoadmapMilestoneSnapshot } from "@/lib/career/adaptation-engine";
import { recordCareerEvent } from "@/lib/career/events";
import type { CareerTwinSkillRow } from "@/lib/career/skill-gap";
import type { AdaptationPlan } from "@/lib/validations/adaptation";

export interface AdaptationOutcome {
  adapted: boolean;
  mode: "none" | "patch" | "full_regenerate";
  reason: string;
  roadmapId?: string;
  version?: number;
  readinessScore?: number;
}

async function buildMilestoneSnapshots(
  supabase: SupabaseClient,
  roadmapId: string,
): Promise<RoadmapMilestoneSnapshot[]> {
  const [{ data: milestoneRows }, { data: taskRows }] = await Promise.all([
    supabase.from("roadmap_milestones").select("id, sequence, title, weeks_label, status").eq("roadmap_id", roadmapId).order("sequence", { ascending: true }),
    supabase.from("roadmap_tasks").select("id, milestone_id, status, skills(name)").eq("roadmap_id", roadmapId),
  ]);

  return (milestoneRows ?? []).map((milestone) => {
    const tasks = (taskRows ?? []).filter((task) => task.milestone_id === milestone.id);
    const taskSkills = Array.from(
      new Set(
        tasks
          .map((task) => (task.skills as unknown as { name: string } | null)?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    );
    return {
      id: milestone.id,
      sequence: milestone.sequence,
      title: milestone.title,
      weeksLabel: milestone.weeks_label,
      status: milestone.status as RoadmapMilestoneSnapshot["status"],
      taskIds: tasks.map((task) => task.id),
      completedTaskIds: tasks.filter((task) => task.status === "completed").map((task) => task.id),
      taskSkills,
    };
  });
}

function shiftWeeksLabel(label: string, deltaWeeks: number): string {
  const range = parseWeeksLabel(label);
  if (!range || deltaWeeks === 0) return label;
  const start = Math.max(1, range.start + deltaWeeks);
  const end = Math.max(start, range.end + deltaWeeks);
  return start === end ? `Week ${start}` : `Weeks ${start}-${end}`;
}

/**
 * The Career Orchestrator: the single entry point for turning a career
 * event into a roadmap change. Follows Event -> deterministic calculation
 * (adaptation-engine) -> Adaptation Agent -> Zod validation -> database ->
 * (the UI reads the result on next load). The agent never writes to the
 * database directly — every write below happens after its output has been
 * validated.
 */
export async function adaptRoadmap(
  supabase: SupabaseClient,
  profileId: string,
  trigger: AdaptationTrigger,
): Promise<AdaptationOutcome> {
  const { data: goal } = await supabase
    .from("career_goals")
    .select("id, target_role")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A goal change with no prior goal/roadmap is just a first generation.
  if (trigger.type === "career_goal.changed" || !goal) {
    if (!goal) return { adapted: false, mode: "none", reason: "No active career goal." };
  }

  const { data: profile } = await supabase.from("profiles").select("weekly_hours").eq("id", profileId).single();
  const { data: careerTwin } = await supabase.from("career_twins").select("current_skills").eq("profile_id", profileId).maybeSingle();

  const { data: activeRoadmap } = await supabase
    .from("roadmaps")
    .select("id, version, readiness_score")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (trigger.type === "career_goal.changed") {
    const result = await generateRoadmapForActiveGoal(supabase, profileId);
    if (!result.ok) return { adapted: false, mode: "none", reason: result.error };
    await recordCareerEvent(supabase, profileId, "roadmap.changed", {
      roadmap_id: result.roadmapId,
      previous_roadmap_id: activeRoadmap?.id ?? null,
      version: result.version,
      mode: "full_regenerate",
      reason: `Target role changed to ${trigger.newRole}.`,
      summary: `Roadmap fully regenerated for ${trigger.newRole} with ${result.milestoneCount} milestones.`,
      student_message: `Your roadmap has been rebuilt for your new goal: ${trigger.newRole}.`,
      timeline_changes: "Full roadmap regenerated.",
      timeline_delta_weeks: 0,
      affected_milestones: [],
      preserved_milestones: [],
      readiness_score: result.readinessScore,
      previous_readiness_score: activeRoadmap?.readiness_score ?? null,
      focus_skill: null,
    });
    return { adapted: true, mode: "full_regenerate", reason: "Target role changed.", roadmapId: result.roadmapId, version: result.version, readinessScore: result.readinessScore };
  }

  if (!activeRoadmap) {
    return { adapted: false, mode: "none", reason: "No active roadmap to adapt." };
  }
  if (!goal) {
    return { adapted: false, mode: "none", reason: "No active career goal." };
  }

  const milestones = await buildMilestoneSnapshots(supabase, activeRoadmap.id);
  const careerTwinSkills = (careerTwin?.current_skills as CareerTwinSkillRow[] | null) ?? [];
  const gapResult = await loadSkillGapContext(supabase, profileId, goal.target_role, careerTwinSkills);
  if (!gapResult.ok) return { adapted: false, mode: "none", reason: gapResult.error };
  const { skillGap, readinessScore } = gapResult.context;
  const weeklyHours = profile?.weekly_hours ?? null;

  const changePlan = planRoadmapChange({ trigger, weeklyHours, targetRole: goal.target_role, milestones, skillGap });

  if (changePlan.mode === "none") {
    return { adapted: false, mode: "none", reason: changePlan.reason, roadmapId: activeRoadmap.id, version: activeRoadmap.version };
  }

  // changePlan.mode === "patch" from here on.
  let plan: AdaptationPlan;
  try {
    plan = await generateAdaptationPlan({
      event: trigger,
      changePlan,
      targetRole: goal.target_role,
      milestones,
      skillGap,
      readinessScore,
      weeklyHours,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adaptation planning failed.";
    return { adapted: false, mode: "none", reason: message };
  }

  const { data: existingTasks } = await supabase
    .from("roadmap_tasks")
    .select("id, milestone_id, title, skill_id, estimated_minutes, status, description, evidence_required, why_it_matters, skills(name)")
    .eq("roadmap_id", activeRoadmap.id);

  await supabase.from("roadmaps").update({ status: "archived" }).eq("id", activeRoadmap.id);

  const nextVersion = activeRoadmap.version + 1;
  const { data: newRoadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .insert({
      profile_id: profileId,
      goal_id: goal.id,
      readiness_score: readinessScore,
      version: nextVersion,
      status: "active",
      skill_gap_snapshot: skillGap,
      summary: plan.summary,
      rationale: plan.reason,
    })
    .select("id")
    .single();
  if (roadmapError || !newRoadmap) {
    return { adapted: false, mode: "none", reason: roadmapError?.message ?? "Could not save adapted roadmap." };
  }

  const affectedTitlesLower = new Set(plan.affected_milestones.map((title) => title.toLowerCase()));
  const newTasksByMilestoneTitle = new Map<string, typeof plan.new_tasks>();
  for (const task of plan.new_tasks) {
    const key = task.milestone_title.toLowerCase();
    const bucket = newTasksByMilestoneTitle.get(key) ?? [];
    bucket.push(task);
    newTasksByMilestoneTitle.set(key, bucket);
  }

  let sequence = 0;
  const milestoneInserts: { title: string; sequence: number; weeks_label: string; objective: string; original?: RoadmapMilestoneSnapshot; isNew: boolean }[] = [];
  const matchedNewTaskTitles = new Set<string>();

  for (const milestone of milestones) {
    sequence += 1;
    const isAffected = changePlan.affectedMilestoneIds.includes(milestone.id) || affectedTitlesLower.has(milestone.title.toLowerCase());
    const weeksLabel = isAffected ? shiftWeeksLabel(milestone.weeksLabel, changePlan.timelineDeltaWeeks) : milestone.weeksLabel;
    milestoneInserts.push({ title: milestone.title, sequence, weeks_label: weeksLabel, objective: "", original: milestone, isNew: false });
    if (isAffected) matchedNewTaskTitles.add(milestone.title.toLowerCase());
  }

  // Any new_tasks whose milestone_title didn't match an existing milestone become a brand-new milestone.
  for (const [titleKey, tasks] of newTasksByMilestoneTitle.entries()) {
    if (matchedNewTaskTitles.has(titleKey)) continue;
    sequence += 1;
    const lastRange = milestones.length ? parseWeeksLabel(milestones[milestones.length - 1].weeksLabel) : null;
    const start = (lastRange?.end ?? sequence) + 1;
    const span = Math.max(1, Math.abs(changePlan.timelineDeltaWeeks) || 2);
    milestoneInserts.push({
      title: tasks[0].milestone_title,
      sequence,
      weeks_label: `Weeks ${start}-${start + span - 1}`,
      objective: changePlan.reason,
      isNew: true,
    });
  }

  const { data: insertedMilestones, error: milestoneInsertError } = await supabase
    .from("roadmap_milestones")
    .insert(milestoneInserts.map(({ title, sequence: seq, weeks_label, objective }) => ({
      roadmap_id: newRoadmap.id,
      title,
      sequence: seq,
      weeks_label,
      objective: objective || "Continue building toward your target role.",
    })))
    .select("id, sequence");
  if (milestoneInsertError || !insertedMilestones) {
    return { adapted: false, mode: "none", reason: milestoneInsertError?.message ?? "Could not save adapted milestones." };
  }
  const newMilestoneIdBySequence = new Map(insertedMilestones.map((row) => [row.sequence, row.id]));

  const { data: librarySkills } = await supabase.from("skills").select("id, name");
  const skillIdByName = new Map((librarySkills ?? []).map((skill) => [skill.name.toLowerCase(), skill.id]));
  const gapBySkillName = new Map(skillGap.map((entry) => [entry.skill.toLowerCase(), entry]));

  const taskRowsToInsert: Record<string, unknown>[] = [];

  milestoneInserts.forEach((entry, index) => {
    const newMilestoneId = newMilestoneIdBySequence.get(index + 1);
    if (!newMilestoneId) return;

    // Carry forward existing tasks for this milestone unchanged.
    if (entry.original) {
      const carried = (existingTasks ?? []).filter((task) => task.milestone_id === entry.original!.id);
      for (const task of carried) {
        taskRowsToInsert.push({
          roadmap_id: newRoadmap.id,
          milestone_id: newMilestoneId,
          title: task.title,
          skill_id: task.skill_id,
          estimated_minutes: task.estimated_minutes,
          status: task.status,
          description: task.description,
          evidence_required: task.evidence_required,
          why_it_matters: task.why_it_matters,
        });
      }
    }

    // Append any agent-proposed new tasks targeting this milestone title.
    const additions = newTasksByMilestoneTitle.get(entry.title.toLowerCase()) ?? [];
    for (const task of additions) {
      const gapEntry = gapBySkillName.get(task.skill.toLowerCase());
      const whyItMatters = gapEntry
        ? `Closes your gap in ${gapEntry.skill}: currently level ${gapEntry.current}/5 (${gapEntry.evidenceType}), target level ${gapEntry.required}/5 for ${goal.target_role}.`
        : `Addresses a gap identified after: ${changePlan.reason}`;
      taskRowsToInsert.push({
        roadmap_id: newRoadmap.id,
        milestone_id: newMilestoneId,
        title: task.title,
        skill_id: skillIdByName.get(task.skill.toLowerCase()) ?? null,
        estimated_minutes: Math.max(15, Math.round(task.estimated_hours * 60)),
        status: "pending",
        description: task.description,
        evidence_required: task.evidence_required,
        why_it_matters: whyItMatters,
      });
    }
  });

  if (taskRowsToInsert.length) {
    const { error: taskInsertError } = await supabase.from("roadmap_tasks").insert(taskRowsToInsert);
    if (taskInsertError) {
      return { adapted: false, mode: "none", reason: taskInsertError.message };
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("career_twins")
    .update({ current_readiness_score: readinessScore, updated_at: now })
    .eq("profile_id", profileId);

  const preservedTitles = milestones.filter((m) => changePlan.preservedMilestoneIds.includes(m.id)).map((m) => m.title);

  await recordCareerEvent(supabase, profileId, "roadmap.changed", {
    roadmap_id: newRoadmap.id,
    previous_roadmap_id: activeRoadmap.id,
    version: nextVersion,
    mode: "patch",
    reason: plan.reason,
    summary: plan.summary,
    student_message: plan.student_message,
    timeline_changes: plan.timeline_changes,
    timeline_delta_weeks: changePlan.timelineDeltaWeeks,
    affected_milestones: plan.affected_milestones,
    preserved_milestones: preservedTitles,
    readiness_score: readinessScore,
    previous_readiness_score: activeRoadmap.readiness_score,
    focus_skill: changePlan.focusSkill,
  });

  return { adapted: true, mode: "patch", reason: plan.reason, roadmapId: newRoadmap.id, version: nextVersion, readinessScore };
}
