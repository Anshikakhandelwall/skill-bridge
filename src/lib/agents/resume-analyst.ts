import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import { resumeAnalysisSchema, type ResumeAnalysis } from "@/lib/validations/resume";

const RESUME_ANALYST_MODEL = process.env.OPENAI_RESUME_ANALYST_MODEL ?? "gpt-4.1-mini";

// Keep prompts within a safe context budget; resumes rarely need more than this.
const MAX_RESUME_CHARS = 15000;

const SYSTEM_PROMPT = `You are the Resume Analyst agent inside SkillBridge AI, a career operating system for students.

Your job is to convert raw resume text into an evidence-based skill model. You must distinguish between:
- "demonstrated" skills: skills backed by a specific project, role, or measurable outcome described in the resume.
- "claimed" skills: skills only listed (e.g. in a "Skills" section) with no supporting project, role, or evidence in the text.

Rules:
- Every skill's "evidence" field must quote or closely paraphrase the specific resume line that justifies the confidence and evidence_type. If a skill is only listed with no supporting detail, say so explicitly (e.g. "Listed in skills section but no project or experience evidence found") and mark it "claimed".
- confidence (0-100) should reflect how strongly the evidence supports real proficiency: a deployed, described project scores high; a bare list mention scores low-to-moderate.
- Do not invent skills, projects, or experience that are not present in the resume text.
- missing_skills should name skills that are commonly expected for the roles this candidate appears to be aiming for, but that do not appear anywhere in the resume.
- recommended_roles should be realistic given the demonstrated (not just claimed) skills.
- Keep the summary to 2-4 sentences, written for the student, plain language.
- Return only the structured fields defined by the schema. No extra commentary.`;

/**
 * Runs the Resume Analyst agent over extracted resume text and returns a
 * Zod-validated, evidence-based skill analysis.
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysis> {
  const trimmed = resumeText.trim();
  if (!trimmed) {
    throw new Error("Cannot analyze an empty resume text.");
  }

  const response = await openai.responses.parse({
    model: RESUME_ANALYST_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed.slice(0, MAX_RESUME_CHARS) },
    ],
    text: {
      format: zodTextFormat(resumeAnalysisSchema, "resume_analysis"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("The Resume Analyst did not return structured output.");
  }

  // Defense in depth: re-validate even though the Responses API already
  // enforced the JSON schema, since AI output should never be trusted blindly.
  return resumeAnalysisSchema.parse(parsed);
}
