import { z } from "zod";
import { ASSESSMENT_TYPES } from "@/lib/career/assessment";

export const assessmentStartSchema = z.object({
  skill: z.string().trim().min(1).max(80),
  assessmentType: z.enum(ASSESSMENT_TYPES).default("technical_quiz"),
});

export const assessmentSubmitSchema = z.object({
  assessmentId: z.string().uuid(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100).optional(),
});
