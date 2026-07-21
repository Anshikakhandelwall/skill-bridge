import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import {
  interviewFeedbackSchema,
  interviewQuestionSetSchema,
  type InterviewAnswer,
  type InterviewDifficulty,
  type InterviewFeedback,
  type InterviewQuestion,
} from "@/lib/validations/interview";

const QUESTION_MODEL = process.env.OPENAI_INTERVIEW_QUESTION_MODEL ?? "gpt-4.1-mini";
const EVALUATION_MODEL = process.env.OPENAI_INTERVIEW_EVALUATION_MODEL ?? "gpt-4.1-mini";

export interface PrioritySkillGap {
  skill: string;
  required: number;
  current: number;
  priority: number;
}

export interface CompletedProjectSummary {
  title: string;
  skills: string[];
}

export interface InterviewQuestionGenInput {
  targetRole: string;
  difficulty: InterviewDifficulty;
  readinessScore: number;
  prioritySkillGaps: PrioritySkillGap[];
  completedProjects: CompletedProjectSummary[];
  githubSummary: string | null;
  resumeSummary: string | null;
}

export interface InterviewEvaluationInput {
  targetRole: string;
  difficulty: InterviewDifficulty;
  readinessScore: number;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
}

const QUESTION_SYSTEM_PROMPT = `You are the Interview Agent inside SkillBridge AI, a career operating system for students. This step generates a mock interview — you are not a chatbot, you produce one structured question set per call.

Rules:
- Generate 5-8 questions covering a realistic mix: at least one "technical" question, at least one "behavioral" question, at least one "project_discussion" question if completedProjects is non-empty, and one or more "follow_up" questions that probe deeper on a technical or project answer.
- Every question's target_skill should come from prioritySkillGaps when possible, prioritizing the highest-priority entries. It's fine to also cover a skill implied by githubSummary or resumeSummary if it's directly relevant to the target role.
- "project_discussion" questions must reference an actual project title from completedProjects — never invent a project that isn't in the list. If completedProjects is empty, skip this type entirely.
- why_asked must explain the specific gap or evidence this question is probing — not generic interview boilerplate.
- Calibrate depth to "difficulty": beginner questions test fundamentals with room to explain reasoning; advanced questions expect trade-off analysis and system-level thinking.
- Give each question a short unique id ("q1", "q2", ...).
- Return only the structured fields defined by the schema. No extra commentary.`;

const EVALUATION_SYSTEM_PROMPT = `You are the Interview Agent inside SkillBridge AI, evaluating a student's mock interview answers. You are a structured evaluation tool, not a chatbot.

Rules:
- Score strictly based on the actual answer content provided. An empty, off-topic, or very thin answer must score low on every relevant dimension — never give credit for effort alone.
- skill_evaluations must cover every distinct target_skill that appeared across the provided questions, each with a 0-100 score and an assessment of "strong" (demonstrated clear understanding), "adequate" (partial/surface understanding), or "weak" (missing, wrong, or unanswered).
- strengths and weaknesses must reference specific things the student actually said (or failed to say), not generic interview advice.
- improvement_tasks should be concrete next actions tied to a specific weak skill from skill_evaluations — not vague "practice more" advice.
- feedback is a constructive 3-6 sentence narrative summary written directly to the student.
- recommended_next_topics should be specific topics/skills worth studying next, grounded in the weakest skill_evaluations.
- Return only the structured fields defined by the schema. No extra commentary.`;

/** Generates a role-specific mock interview question set, grounded only in the evidence provided. */
export async function generateInterviewQuestions(input: InterviewQuestionGenInput): Promise<InterviewQuestion[]> {
  if (!input.prioritySkillGaps.length) {
    throw new Error("Cannot generate interview questions without skill gap data.");
  }

  const response = await openai.responses.parse({
    model: QUESTION_MODEL,
    input: [
      { role: "system", content: QUESTION_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    text: { format: zodTextFormat(interviewQuestionSetSchema, "interview_questions") },
  });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("The Interview Agent did not return structured questions.");
  return interviewQuestionSetSchema.parse(parsed).questions;
}

/** Evaluates submitted answers and returns Zod-validated structured feedback. */
export async function evaluateInterviewAnswers(input: InterviewEvaluationInput): Promise<InterviewFeedback> {
  const response = await openai.responses.parse({
    model: EVALUATION_MODEL,
    input: [
      { role: "system", content: EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    text: { format: zodTextFormat(interviewFeedbackSchema, "interview_feedback") },
  });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("The Interview Agent did not return structured feedback.");
  return interviewFeedbackSchema.parse(parsed);
}
