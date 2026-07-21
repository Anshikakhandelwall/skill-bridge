import type { SupabaseClient } from "@supabase/supabase-js";
import { confidenceToLevel } from "@/lib/resume/readiness-score";
import type { GithubAnalysis } from "@/lib/validations/github";
import type { EvidenceType } from "@/types/career";

const EVIDENCE_RANK: Record<EvidenceType, number> = { claimed: 0, inferred: 1, assessed: 2, demonstrated: 3 };

/** Confidence assigned to a newly-created inferred-only skill (no existing record to carry a confidence from). */
const INFERRED_DEFAULT_CONFIDENCE = 40;

export interface GithubSkillMergeResult {
  /** Skills that moved to (or already were, but got reinforced at) demonstrated because of this GitHub analysis. */
  newlyDemonstrated: string[];
}

/**
 * Merges GitHub evidence into student_skills using the evidence rules:
 *   resume demonstrated + GitHub demonstrated -> demonstrated (unchanged)
 *   resume claimed + GitHub demonstrated       -> upgraded to demonstrated
 *   GitHub inferred                            -> inferred (only if below that rank already)
 *   never downgrade an existing evidence_type
 */
export async function mergeGithubEvidenceIntoStudentSkills(
  supabase: SupabaseClient,
  profileId: string,
  analysis: GithubAnalysis,
): Promise<GithubSkillMergeResult> {
  const [{ data: librarySkills }, { data: existingSkills }] = await Promise.all([
    supabase.from("skills").select("id, name"),
    supabase
      .from("student_skills")
      .select("id, skill_id, custom_skill_name, level, evidence_type, confidence")
      .eq("profile_id", profileId),
  ]);

  const libraryIdByName = new Map((librarySkills ?? []).map((skill) => [skill.name.toLowerCase(), skill.id]));
  const libraryNameById = new Map((librarySkills ?? []).map((skill) => [skill.id, skill.name]));
  const existingByName = new Map(
    (existingSkills ?? []).map((row) => [
      (row.custom_skill_name ?? libraryNameById.get(row.skill_id) ?? "").toLowerCase(),
      row,
    ]),
  );

  const now = new Date().toISOString();
  const newlyDemonstrated: string[] = [];

  for (const skill of analysis.demonstrated_skills) {
    const key = skill.name.toLowerCase();
    const existing = existingByName.get(key);
    const derivedLevel = confidenceToLevel(skill.confidence);

    if (existing) {
      const wasDemonstrated = existing.evidence_type === "demonstrated";
      const finalEvidenceType: EvidenceType =
        EVIDENCE_RANK[existing.evidence_type as EvidenceType] >= EVIDENCE_RANK.demonstrated
          ? (existing.evidence_type as EvidenceType)
          : "demonstrated";
      await supabase
        .from("student_skills")
        .update({
          evidence_type: finalEvidenceType,
          level: Math.max(existing.level, derivedLevel),
          confidence: Math.max(existing.confidence, skill.confidence),
          last_updated_at: now,
        })
        .eq("id", existing.id);
      if (!wasDemonstrated) newlyDemonstrated.push(skill.name);
    } else {
      const libraryId = libraryIdByName.get(key) ?? null;
      await supabase.from("student_skills").insert({
        profile_id: profileId,
        skill_id: libraryId,
        custom_skill_name: libraryId ? null : skill.name,
        level: derivedLevel,
        evidence_type: "demonstrated",
        confidence: skill.confidence,
      });
      newlyDemonstrated.push(skill.name);
    }
  }

  for (const skill of analysis.inferred_skills) {
    const key = skill.name.toLowerCase();
    const existing = existingByName.get(key);

    if (existing) {
      if (EVIDENCE_RANK[existing.evidence_type as EvidenceType] < EVIDENCE_RANK.inferred) {
        await supabase
          .from("student_skills")
          .update({
            evidence_type: "inferred",
            confidence: Math.max(existing.confidence, INFERRED_DEFAULT_CONFIDENCE),
            last_updated_at: now,
          })
          .eq("id", existing.id);
      }
      // Already inferred/assessed/demonstrated: leave untouched. Never downgrade.
    } else {
      const libraryId = libraryIdByName.get(key) ?? null;
      await supabase.from("student_skills").insert({
        profile_id: profileId,
        skill_id: libraryId,
        custom_skill_name: libraryId ? null : skill.name,
        level: confidenceToLevel(INFERRED_DEFAULT_CONFIDENCE),
        evidence_type: "inferred",
        confidence: INFERRED_DEFAULT_CONFIDENCE,
      });
    }
  }

  return { newlyDemonstrated };
}
