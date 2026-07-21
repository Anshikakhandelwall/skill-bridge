import { z } from "zod";

export const roadmapTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  skill: z.string().trim().min(1).max(80),
  estimated_hours: z.number().min(0.5).max(40),
  evidence_required: z.string().trim().min(1).max(300),
});

export const roadmapMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(160),
  weeks: z.string().trim().min(1).max(40),
  objective: z.string().trim().min(1).max(400),
  tasks: z.array(roadmapTaskSchema).min(1).max(8),
});

export const careerPlanSchema = z.object({
  readiness_score: z.number().min(0).max(100),
  summary: z.string().trim().min(1).max(800),
  milestones: z.array(roadmapMilestoneSchema).min(1).max(10),
  rationale: z.string().trim().min(1).max(800),
});

export type RoadmapTask = z.infer<typeof roadmapTaskSchema>;
export type RoadmapMilestone = z.infer<typeof roadmapMilestoneSchema>;
export type CareerPlan = z.infer<typeof careerPlanSchema>;
