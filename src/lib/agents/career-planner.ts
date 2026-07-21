import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import { careerPlanSchema, type CareerPlan } from "@/lib/validations/roadmap";
import type { SkillGapMatrix } from "@/lib/career/skill-gap";

const CAREER_PLANNER_MODEL = process.env.OPENAI_CAREER_PLANNER_MODEL ?? "gpt-4.1-mini";

export interface CareerPlannerInput {
  targetRole: string;
  targetDate: string | null;
  weeklyHours: number | null;
  workloadLevel: string | null;
  learningStyle: string | null;
  readinessScore: number;
  skillGap: SkillGapMatrix;
  strengths: string[];
}

const SYSTEM_PROMPT = `You are the Career Planner agent inside SkillBridge AI, a career operating system for students.

You turn an evidence-weighted skill gap matrix into a milestone-based roadmap toward a target role. You never invent skills, scores, or evidence — you only work with what's provided.

Rules:
- Build milestones and tasks only from the skills present in the provided skill gap matrix. Every task's "skill" field must exactly match a skill name from that matrix.
- Sequence milestones in a learning-logical order (foundational skills before advanced ones), but weight sequencing toward the highest-priority gaps in the matrix — priority is already computed for you (0-1, higher means more urgent).
- Do not manufacture milestones for skills with priority 0 (already at or above the required level) unless nothing else remains.
- Each task's "evidence_required" must describe a concrete, checkable artifact (e.g. "Deployed GitHub repo with a working auth flow", "Passing score on a React state-management assessment") — never vague language like "practice more" or "study harder".
- Size each milestone's total estimated_hours roughly to the student's weekly_hours budget multiplied by the number of weeks in that milestone's range.
- "readiness_score" in your output must exactly restate the readiness score you were given — do not recompute or adjust it.
- "rationale" should be 2-4 sentences that explain the sequencing choices in terms of the actual gaps and priorities provided, not generic career advice.
- "summary" should be 2-3 sentences written for the student, plain language, referencing their target role and current readiness.
- Return only the structured fields defined by the schema. No extra commentary.`;

/**
 * Runs the Career Planner agent over a precomputed skill gap matrix and
 * returns a Zod-validated roadmap. The agent never touches the database —
 * the caller is responsible for persisting the result.
 */
export async function generateCareerPlan(input: CareerPlannerInput): Promise<CareerPlan> {
  if (!input.skillGap.length) {
    throw new Error("Cannot generate a roadmap without a skill gap matrix.");
  }

  const response = await openai.responses.parse({
    model: CAREER_PLANNER_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    text: {
      format: zodTextFormat(careerPlanSchema, "career_plan"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("The Career Planner did not return structured output.");
  }

  // Defense in depth, same as the Resume Analyst: re-validate AI output
  // even though the Responses API already enforced the JSON schema.
  return careerPlanSchema.parse(parsed);
}
