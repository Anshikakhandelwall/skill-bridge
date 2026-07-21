import { z } from "zod";

export const roleOptions = ["Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "Cyber Security", "UI/UX Designer", "Custom Goal"] as const;
export const learningStyles = ["videos", "reading", "building_projects", "mixed"] as const;
export const workloadLevels = ["low", "medium", "high"] as const;
export const skillLevels = ["beginner", "intermediate", "advanced"] as const;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  collegeUniversity: z.string().trim().min(2).max(160),
  degree: z.string().trim().min(2).max(120),
  graduationYear: z.coerce.number().int().min(2000).max(2100),
  currentSemester: z.coerce.number().int().min(1).max(20),
  weeklyHours: z.coerce.number().int().min(1).max(80),
  workloadLevel: z.enum(workloadLevels),
  interests: z.array(z.string().trim().min(1).max(50)).max(12),
});

export const goalSchema = z.object({
  targetRole: z.enum(roleOptions),
  customGoal: z.string().trim().max(120).optional(),
  targetDate: z.string().date(),
  learningStyle: z.enum(learningStyles),
}).superRefine((value, ctx) => {
  if (value.targetRole === "Custom Goal" && !value.customGoal) ctx.addIssue({ code: "custom", path: ["customGoal"], message: "Tell us the role you are targeting." });
});

export const selectedSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  level: z.enum(skillLevels),
  isCustom: z.boolean().default(false),
});

export const onboardingPayloadSchema = z.object({
  profile: profileSchema.optional(),
  goal: goalSchema.optional(),
  skills: z.array(selectedSkillSchema).max(30).optional(),
  completed: z.boolean().optional(),
});

export type OnboardingFormData = z.infer<typeof profileSchema> & z.infer<typeof goalSchema> & { skills: z.infer<typeof selectedSkillSchema>[] };
