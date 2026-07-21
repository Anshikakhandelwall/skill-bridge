import { z } from "zod";

export const RESUME_MAX_BYTES = 8 * 1024 * 1024; // 8MB
export const RESUME_ALLOWED_MIME_TYPES = ["application/pdf"] as const;

export const resumeIdSchema = z.object({
  resumeId: z.string().uuid(),
});

export const evidenceTypeSchema = z.enum(["claimed", "demonstrated"]);

export const resumeSkillEvidenceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  confidence: z.number().min(0).max(100),
  evidence: z.string().trim().min(1).max(500),
  evidence_type: evidenceTypeSchema,
});

export const resumeProjectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  technologies: z.array(z.string().trim().min(1).max(60)).max(20),
  description: z.string().trim().min(1).max(600),
});

export const resumeAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  skills: z.array(resumeSkillEvidenceSchema).max(40),
  projects: z.array(resumeProjectSchema).max(20),
  strengths: z.array(z.string().trim().min(1).max(200)).max(15),
  missing_skills: z.array(z.string().trim().min(1).max(80)).max(20),
  recommended_roles: z.array(z.string().trim().min(1).max(80)).max(10),
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type ResumeSkillEvidence = z.infer<typeof resumeSkillEvidenceSchema>;
