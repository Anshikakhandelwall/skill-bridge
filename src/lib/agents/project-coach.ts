import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import { projectPlanSchema, type ProjectPlan } from "@/lib/validations/project";

const PROJECT_COACH_MODEL = process.env.OPENAI_PROJECT_COACH_MODEL ?? "gpt-4.1-mini";

export interface PrioritySkillGap {
  skill: string;
  required: number;
  current: number;
  gap: number;
  priority: number;
}

export interface RecentProject {
  title: string;
  skills: string[];
}

export interface ProjectCoachInput {
  targetRole: string;
  readinessScore: number;
  learningStyle: string | null;
  weeklyHours: number | null;
  prioritySkillGaps: PrioritySkillGap[];
  recentCompletedProjects: RecentProject[];
}

const SYSTEM_PROMPT = `You are the Project Coach agent inside SkillBridge AI, a career operating system for students.

You turn a student's highest-priority skill gaps into a single portfolio-quality project plan. You are a structured planning tool, not a chatbot — you produce one complete, buildable project spec per call.

Rules:
- The project MUST target one or more of the skills in prioritySkillGaps, prioritizing the highest-priority (highest "priority" value) entries first. List those skill names in "skills".
- Never propose a trivial CRUD-only or single-model exercise (e.g. a plain to-do list, a single-page calculator). The project must combine multiple real features — for a frontend gap, the quality bar looks like: an app with authentication, a real dashboard, data visualization, and a live deployment — not a to-do list.
- Scale scope to the student's current readiness and weekly_hours: lower readiness or fewer weekly hours means a smaller but still substantive project (fewer features, not lower quality); higher readiness supports a more ambitious scope. estimated_hours should be realistic for someone at this readiness level, roughly divisible into weekly chunks given weekly_hours.
- Do not propose a project whose core concept duplicates a title in recentCompletedProjects — build on those skills with something new instead.
- milestones should be a buildable sequence (e.g. setup/data model -> core feature -> secondary feature -> polish/deploy), each with concrete tasks, not vague steps.
- acceptance_criteria must be concrete and checkable (e.g. "User can log in and see only their own transactions"), not generic.
- deployment must name a specific, realistic path (e.g. "Deploy the frontend to Vercel and the API to Render; connect a managed Postgres instance").
- readme_template should be realistic README markdown content for this specific project (sections like Overview, Features, Tech Stack, Setup, Screenshots) — written as if for this project, not a generic placeholder.
- resume_bullet must be a single polished, outcome-oriented resume bullet for this specific project (mention the stack and a concrete capability, not generic praise).
- interview_questions should be specific to technical decisions this project actually requires (e.g. "How did you handle authentication state across page reloads?"), not generic interview prep questions.
- Return only the structured fields defined by the schema. No extra commentary.`;

/**
 * Runs the Project Coach agent and returns a Zod-validated project plan.
 * The agent only plans — it never writes to the database or marks
 * anything complete; the caller persists the result.
 */
export async function generateProjectPlan(input: ProjectCoachInput): Promise<ProjectPlan> {
  if (!input.prioritySkillGaps.length) {
    throw new Error("Cannot generate a project without at least one priority skill gap.");
  }

  const response = await openai.responses.parse({
    model: PROJECT_COACH_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    text: {
      format: zodTextFormat(projectPlanSchema, "project_plan"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("The Project Coach did not return structured output.");
  }

  return projectPlanSchema.parse(parsed);
}
