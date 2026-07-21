import { z } from "zod";

export const projectDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const projectMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(400),
  tasks: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
});

export const projectPlanSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(600),
  difficulty: projectDifficultySchema,
  estimated_hours: z.number().min(1).max(200),
  skills: z.array(z.string().trim().min(1).max(80)).min(1).max(15),
  problem_statement: z.string().trim().min(1).max(800),
  learning_objectives: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  features: z.array(z.string().trim().min(1).max(200)).min(1).max(15),
  technical_requirements: z.array(z.string().trim().min(1).max(200)).min(1).max(15),
  /** Flat list of file/directory paths, e.g. "src/components/Dashboard.tsx". */
  folder_structure: z.array(z.string().trim().min(1).max(200)).min(1).max(40),
  milestones: z.array(projectMilestoneSchema).min(1).max(8),
  acceptance_criteria: z.array(z.string().trim().min(1).max(250)).min(1).max(15),
  deployment: z.string().trim().min(1).max(500),
  readme_template: z.string().trim().min(1).max(4000),
  resume_bullet: z.string().trim().min(1).max(300),
  interview_questions: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
});

export type ProjectDifficulty = z.infer<typeof projectDifficultySchema>;
export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;
export type ProjectPlan = z.infer<typeof projectPlanSchema>;
