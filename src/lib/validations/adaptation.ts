import { z } from "zod";

export const adaptationNewTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  skill: z.string().trim().min(1).max(80),
  estimated_hours: z.number().min(0.5).max(40),
  evidence_required: z.string().trim().min(1).max(300),
  /** Title of the milestone this task belongs under. May match an existing
   *  affected milestone, or name a new remediation milestone to create. */
  milestone_title: z.string().trim().min(1).max(160),
});

export const adaptationPlanSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(500),
  affected_milestones: z.array(z.string().trim().min(1).max(160)).max(10),
  new_tasks: z.array(adaptationNewTaskSchema).max(10),
  timeline_changes: z.string().trim().min(1).max(400),
  student_message: z.string().trim().min(1).max(400),
});

export type AdaptationNewTask = z.infer<typeof adaptationNewTaskSchema>;
export type AdaptationPlan = z.infer<typeof adaptationPlanSchema>;
