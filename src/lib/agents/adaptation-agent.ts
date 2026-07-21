import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import { adaptationPlanSchema, type AdaptationPlan } from "@/lib/validations/adaptation";
import type { AdaptationTrigger, RoadmapChangePlan, RoadmapMilestoneSnapshot } from "@/lib/career/adaptation-engine";
import type { SkillGapMatrix } from "@/lib/career/skill-gap";

const ADAPTATION_AGENT_MODEL = process.env.OPENAI_ADAPTATION_AGENT_MODEL ?? "gpt-4.1-mini";

export interface AdaptationAgentInput {
  event: AdaptationTrigger;
  changePlan: RoadmapChangePlan;
  targetRole: string;
  milestones: RoadmapMilestoneSnapshot[];
  skillGap: SkillGapMatrix;
  readinessScore: number;
  weeklyHours: number | null;
}

const SYSTEM_PROMPT = `You are the Adaptation Agent inside SkillBridge AI, a career operating system for students.

A deterministic engine has already decided WHICH milestones may change (affected_milestone ids/titles you're given) and WHICH must stay untouched (preserved milestones — never mention or alter these). Your job is to decide WHAT the change looks like, within those boundaries.

Rules:
- Never propose changes to preserved/completed milestones. Do not include them in affected_milestones.
- Every new_tasks[].skill must exactly match a skill name present in the provided skill gap matrix.
- Every new_tasks[].milestone_title should either match the title of an existing affected milestone (to add a task there) or introduce a short, clear new milestone title (e.g. "React Remediation") if the event calls for something not covered by an existing milestone.
- evidence_required must describe a concrete, checkable artifact — never vague language like "practice more".
- timeline_changes should describe the schedule impact in plain language, consistent with the timelineDeltaWeeks sign you're given (positive = timeline extended, negative = timeline compressed, zero = no change).
- student_message is a short, encouraging 1-2 sentence note shown directly to the student explaining the change in plain language — not corporate, not alarming.
- reason should explain WHY this change is happening, grounded in the actual event and skill gap data provided — not generic advice.
- If the deterministic plan's mode indicates no milestones are affected, still return a valid object: affected_milestones and new_tasks can be empty arrays, but summary/reason/timeline_changes/student_message must still describe the (lack of) impact.
- Return only the structured fields defined by the schema. No extra commentary.`;

/**
 * Runs the Adaptation Agent. The agent never touches the database — it only
 * returns a validated plan describing what should change; the orchestrator
 * is responsible for applying it.
 */
export async function generateAdaptationPlan(input: AdaptationAgentInput): Promise<AdaptationPlan> {
  const response = await openai.responses.parse({
    model: ADAPTATION_AGENT_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    text: {
      format: zodTextFormat(adaptationPlanSchema, "roadmap_adaptation"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("The Adaptation Agent did not return structured output.");
  }

  return adaptationPlanSchema.parse(parsed);
}
