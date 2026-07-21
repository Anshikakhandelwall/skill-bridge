import type { SkillGapMatrix } from "@/lib/career/skill-gap";

export type AdaptationTrigger =
  | { type: "assessment.failed"; skill: string; score: number }
  | { type: "assessment.completed"; skill: string; score: number }
  | { type: "weekly_hours.changed"; previousHours: number | null; newHours: number }
  | { type: "career_goal.changed"; previousRole: string | null; newRole: string }
  | { type: "project.completed"; taskId?: string }
  | { type: "github.analyzed"; newDemonstratedSkills: string[]; readinessDelta: number }
  | { type: "interview.completed"; weakSkills: string[]; readinessDelta: number }
  | { type: "resume.analyzed" };

export interface RoadmapMilestoneSnapshot {
  id: string;
  sequence: number;
  title: string;
  weeksLabel: string;
  status: "pending" | "in_progress" | "completed";
  taskIds: string[];
  completedTaskIds: string[];
  taskSkills: string[]; // distinct skill names touched by this milestone's tasks
}

export interface AdaptationEngineInput {
  trigger: AdaptationTrigger;
  weeklyHours: number | null;
  targetRole: string;
  milestones: RoadmapMilestoneSnapshot[];
  skillGap: SkillGapMatrix;
}

export type AdaptationMode = "none" | "patch" | "full_regenerate";

export interface RoadmapChangePlan {
  mode: AdaptationMode;
  reason: string;
  focusSkill: string | null;
  needsRemediation: boolean;
  preservedMilestoneIds: string[];
  affectedMilestoneIds: string[];
  /** Positive = expand the timeline (add weeks), negative = compress it. */
  timelineDeltaWeeks: number;
}

const PASS_THRESHOLD = 70;

/** Extracts a rough [start, end] week range from labels like "Weeks 1-3" or "Week 4". */
export function parseWeeksLabel(label: string): { start: number; end: number } | null {
  const rangeMatch = label.match(/(\d+)\D+(\d+)/);
  if (rangeMatch) return { start: Number(rangeMatch[1]), end: Number(rangeMatch[2]) };
  const singleMatch = label.match(/(\d+)/);
  if (singleMatch) {
    const week = Number(singleMatch[1]);
    return { start: week, end: week };
  }
  return null;
}

function isFullyCompleted(milestone: RoadmapMilestoneSnapshot): boolean {
  return (
    milestone.status === "completed" ||
    (milestone.taskIds.length > 0 && milestone.completedTaskIds.length === milestone.taskIds.length)
  );
}

function estimateRemainingWeeks(milestones: RoadmapMilestoneSnapshot[]): number {
  let total = 0;
  for (const milestone of milestones) {
    const range = parseWeeksLabel(milestone.weeksLabel);
    total += range ? Math.max(1, range.end - range.start + 1) : 2; // fall back to a 2-week estimate
  }
  return total;
}

/**
 * Computes what kind of roadmap change an event calls for, and — critically —
 * which milestones must be preserved untouched (already completed) versus
 * which are candidates for modification. Produces no content itself; the
 * Adaptation Agent fills in the actual task/milestone text within these
 * boundaries.
 */
export function planRoadmapChange(input: AdaptationEngineInput): RoadmapChangePlan {
  const { trigger, milestones, skillGap } = input;

  const preservedMilestoneIds = milestones.filter(isFullyCompleted).map((m) => m.id);
  const nonPreserved = milestones.filter((m) => !preservedMilestoneIds.includes(m.id));

  switch (trigger.type) {
    case "career_goal.changed": {
      return {
        mode: "full_regenerate",
        reason: `Target role changed${trigger.previousRole ? ` from ${trigger.previousRole}` : ""} to ${trigger.newRole}. The skill gap has been recalculated for the new role and the roadmap is being regenerated.`,
        focusSkill: null,
        needsRemediation: false,
        preservedMilestoneIds: [],
        affectedMilestoneIds: milestones.map((m) => m.id),
        timelineDeltaWeeks: 0,
      };
    }

    case "assessment.failed": {
      const affected = nonPreserved
        .filter((m) => m.taskSkills.some((s) => s.toLowerCase() === trigger.skill.toLowerCase()))
        .map((m) => m.id);
      const gapEntry = skillGap.find((entry) => entry.skill.toLowerCase() === trigger.skill.toLowerCase());
      return {
        mode: "patch",
        reason: `${trigger.skill} assessment scored ${trigger.score}% (below the ${PASS_THRESHOLD}% pass bar)${gapEntry ? `, widening the gap to a required level of ${gapEntry.required}` : ""}. Remediation is needed before advancing further in ${trigger.skill}.`,
        focusSkill: trigger.skill,
        needsRemediation: true,
        preservedMilestoneIds,
        affectedMilestoneIds: affected,
        timelineDeltaWeeks: 1,
      };
    }

    case "assessment.completed": {
      const affected = nonPreserved
        .filter((m) => m.taskSkills.some((s) => s.toLowerCase() === trigger.skill.toLowerCase()))
        .map((m) => m.id);
      return {
        mode: affected.length ? "patch" : "none",
        reason: `${trigger.skill} assessment passed with a score of ${trigger.score}%. Related tasks can be marked verified and remaining ones re-prioritized.`,
        focusSkill: trigger.skill,
        needsRemediation: false,
        preservedMilestoneIds,
        affectedMilestoneIds: affected,
        timelineDeltaWeeks: 0,
      };
    }

    case "weekly_hours.changed": {
      const previous = trigger.previousHours ?? input.weeklyHours ?? 0;
      const next = trigger.newHours;
      if (previous <= 0 || next <= 0 || previous === next) {
        return {
          mode: "none",
          reason: "Weekly hours changed but not enough to affect the timeline.",
          focusSkill: null,
          needsRemediation: false,
          preservedMilestoneIds,
          affectedMilestoneIds: [],
          timelineDeltaWeeks: 0,
        };
      }
      const remainingWeeks = estimateRemainingWeeks(nonPreserved);
      const workRatio = previous / next; // <1 means more hours available -> compress
      const rawDelta = Math.round(remainingWeeks * (workRatio - 1));
      const timelineDeltaWeeks = Math.max(-8, Math.min(8, rawDelta));
      const direction = timelineDeltaWeeks < 0 ? "compressed" : timelineDeltaWeeks > 0 ? "expanded" : "kept the same";
      return {
        mode: nonPreserved.length ? "patch" : "none",
        reason: `Weekly study time changed from ${previous} to ${next} hours. The remaining timeline is ${direction} by about ${Math.abs(timelineDeltaWeeks)} week(s).`,
        focusSkill: null,
        needsRemediation: false,
        preservedMilestoneIds,
        affectedMilestoneIds: nonPreserved.map((m) => m.id),
        timelineDeltaWeeks,
      };
    }

    case "project.completed": {
      return {
        mode: nonPreserved.length ? "patch" : "none",
        reason: "A project was completed, providing demonstrated evidence and freeing up time in the schedule.",
        focusSkill: null,
        needsRemediation: false,
        preservedMilestoneIds,
        affectedMilestoneIds: nonPreserved.map((m) => m.id),
        timelineDeltaWeeks: -1,
      };
    }

    case "github.analyzed": {
      const bySkill = nonPreserved
        .filter((m) => m.taskSkills.some((s) => trigger.newDemonstratedSkills.some((skill) => skill.toLowerCase() === s.toLowerCase())))
        .map((m) => m.id);
      const isSignificant = Math.abs(trigger.readinessDelta) >= 5 || trigger.newDemonstratedSkills.length > 0;
      const affected = bySkill.length ? bySkill : isSignificant ? nonPreserved.map((m) => m.id) : [];
      const skillsList = trigger.newDemonstratedSkills.length ? ` (${trigger.newDemonstratedSkills.join(", ")})` : "";
      return {
        mode: affected.length ? "patch" : "none",
        reason: `GitHub analysis found ${trigger.newDemonstratedSkills.length} newly demonstrated skill(s)${skillsList} and moved readiness by ${trigger.readinessDelta >= 0 ? "+" : ""}${trigger.readinessDelta} points. Upcoming tasks for these skills may now be redundant or ready to verify.`,
        focusSkill: trigger.newDemonstratedSkills[0] ?? null,
        needsRemediation: false,
        preservedMilestoneIds,
        affectedMilestoneIds: affected,
        timelineDeltaWeeks: trigger.readinessDelta >= 5 ? -1 : 0,
      };
    }

    case "interview.completed": {
      const bySkill = nonPreserved
        .filter((m) => m.taskSkills.some((s) => trigger.weakSkills.some((skill) => skill.toLowerCase() === s.toLowerCase())))
        .map((m) => m.id);
      const isSignificant = trigger.weakSkills.length > 0 || Math.abs(trigger.readinessDelta) >= 5;
      const affected = bySkill.length ? bySkill : isSignificant ? nonPreserved.map((m) => m.id) : [];
      const weakList = trigger.weakSkills.length ? ` (${trigger.weakSkills.join(", ")})` : "";
      return {
        mode: affected.length ? "patch" : "none",
        reason: `Interview practice revealed ${trigger.weakSkills.length} weak competenc${trigger.weakSkills.length === 1 ? "y" : "ies"}${weakList}, moving readiness by ${trigger.readinessDelta >= 0 ? "+" : ""}${trigger.readinessDelta} points. Remediation is recommended before the next interview.`,
        focusSkill: trigger.weakSkills[0] ?? null,
        needsRemediation: trigger.weakSkills.length > 0,
        preservedMilestoneIds,
        affectedMilestoneIds: affected,
        timelineDeltaWeeks: trigger.weakSkills.length > 0 ? 1 : 0,
      };
    }

    case "resume.analyzed": {
      // New resume evidence can shift priorities without a hard failure/pass
      // signal. Treat as a light-touch review of non-preserved milestones.
      return {
        mode: nonPreserved.length ? "patch" : "none",
        reason: "New resume evidence changed your skill evidence. Reviewing upcoming milestones against the updated skill gap.",
        focusSkill: null,
        needsRemediation: false,
        preservedMilestoneIds,
        affectedMilestoneIds: nonPreserved.map((m) => m.id),
        timelineDeltaWeeks: 0,
      };
    }

    default:
      return {
        mode: "none",
        reason: "No adaptation needed.",
        focusSkill: null,
        needsRemediation: false,
        preservedMilestoneIds,
        affectedMilestoneIds: [],
        timelineDeltaWeeks: 0,
      };
  }
}
