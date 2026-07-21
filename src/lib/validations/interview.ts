import { z } from "zod";

export const interviewDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const interviewQuestionTypeSchema = z.enum(["technical", "behavioral", "project_discussion", "follow_up"]);

export const interviewQuestionSchema = z.object({
  id: z.string().trim().min(1).max(20),
  type: interviewQuestionTypeSchema,
  prompt: z.string().trim().min(1).max(500),
  target_skill: z.string().trim().min(1).max(80),
  why_asked: z.string().trim().min(1).max(300),
});

export const interviewQuestionSetSchema = z.object({
  questions: z.array(interviewQuestionSchema).min(5).max(8),
});

export const interviewAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(20),
  answerText: z.string().trim().max(4000),
});

export const interviewRespondSchema = z.object({
  answers: z.array(interviewAnswerSchema).min(1).max(8),
});

export const interviewSkillEvaluationSchema = z.object({
  skill: z.string().trim().min(1).max(80),
  score: z.number().min(0).max(100),
  assessment: z.enum(["strong", "adequate", "weak"]),
});

export const interviewImprovementTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  skill: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
});

export const interviewFeedbackSchema = z.object({
  overall_score: z.number().min(0).max(100),
  communication_score: z.number().min(0).max(100),
  technical_score: z.number().min(0).max(100),
  problem_solving_score: z.number().min(0).max(100),
  confidence_score: z.number().min(0).max(100),
  strengths: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  weaknesses: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  improvement_tasks: z.array(interviewImprovementTaskSchema).min(1).max(8),
  feedback: z.string().trim().min(1).max(1500),
  recommended_next_topics: z.array(z.string().trim().min(1).max(150)).max(10),
  /** Per-skill breakdown used to deterministically update student_skills evidence. */
  skill_evaluations: z.array(interviewSkillEvaluationSchema).min(1).max(15),
});

export type InterviewDifficulty = z.infer<typeof interviewDifficultySchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewQuestionSet = z.infer<typeof interviewQuestionSetSchema>;
export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>;
export type InterviewSkillEvaluation = z.infer<typeof interviewSkillEvaluationSchema>;
export type InterviewFeedback = z.infer<typeof interviewFeedbackSchema>;
