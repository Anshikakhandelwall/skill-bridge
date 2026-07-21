import type { ResumeAnalysis } from "@/lib/validations/resume";

/**
 * Temporary readiness score calculation.
 * Weighs demonstrated skills at full confidence and claimed-only skills
 * at a discount, since a claim without evidence is weaker signal.
 * A dedicated Career Readiness Score engine (role-competency weighted)
 * is planned for a later phase.
 */
export function computeReadinessScore(analysis: ResumeAnalysis): number {
  if (!analysis.skills.length) return 0;

  const CLAIMED_DISCOUNT = 0.4;
  const total = analysis.skills.reduce((sum, skill) => {
    const weight = skill.evidence_type === "demonstrated" ? 1 : CLAIMED_DISCOUNT;
    return sum + skill.confidence * weight;
  }, 0);

  const score = total / analysis.skills.length;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Maps an AI confidence score (0-100) to the student_skills level scale (0-5). */
export function confidenceToLevel(confidence: number): number {
  return Math.max(0, Math.min(5, Math.round(confidence / 20)));
}
