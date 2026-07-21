import { z } from "zod";

export const githubUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(39)
    .regex(/^[a-zA-Z0-9-]+$/, "GitHub usernames can only contain letters, numbers, and hyphens."),
});

export const githubDemonstratedSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  confidence: z.number().min(0).max(100),
  /** Repository names that show this skill in use. Must reference real repos from the provided data. */
  repositories: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
});

export const githubInferredSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(300),
});

export const githubProjectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(400),
  highlights: z.array(z.string().trim().min(1).max(200)).max(6),
});

export const githubAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  demonstrated_skills: z.array(githubDemonstratedSkillSchema).max(30),
  inferred_skills: z.array(githubInferredSkillSchema).max(20),
  strongest_projects: z.array(githubProjectSchema).max(10),
  missing_portfolio_areas: z.array(z.string().trim().min(1).max(150)).max(15),
  confidence: z.number().min(0).max(100),
  recommended_role_adjustments: z.array(z.string().trim().min(1).max(150)).max(10),
});

export type GithubDemonstratedSkill = z.infer<typeof githubDemonstratedSkillSchema>;
export type GithubInferredSkill = z.infer<typeof githubInferredSkillSchema>;
export type GithubAnalysis = z.infer<typeof githubAnalysisSchema>;
