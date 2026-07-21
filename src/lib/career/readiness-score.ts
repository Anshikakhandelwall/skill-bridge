import type { SkillGapMatrix } from "@/lib/career/skill-gap";

/**
 * The authoritative Career Readiness Score, replacing the temporary
 * confidence-average used right after resume analysis (see
 * src/lib/resume/readiness-score.ts). This version is role-aware: it
 * compares evidence-weighted current levels against what the target role
 * actually requires.
 *
 * score = 100 * sum(weight * effective_level) / sum(weight * required_level)
 */
export function calculateReadinessScore(skillGap: SkillGapMatrix): number {
  if (!skillGap.length) return 0;

  const numerator = skillGap.reduce((sum, entry) => sum + entry.weight * entry.effective, 0);
  const denominator = skillGap.reduce((sum, entry) => sum + entry.weight * entry.required, 0);

  if (denominator <= 0) return 0;

  const score = (numerator / denominator) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}
