import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSkillId } from "@/lib/career/assessment";
import { confidenceToLevel } from "@/lib/resume/readiness-score";
import type { EvidenceType } from "@/types/career";

const EVIDENCE_RANK: Record<EvidenceType, number> = { claimed: 0, inferred: 1, assessed: 2, demonstrated: 3 };

/** A completed, portfolio-quality project is as strong a signal as demonstrated GitHub evidence. */
const PROJECT_COMPLETION_CONFIDENCE = 85;

export interface ProjectSkillMergeResult {
  newlyDemonstrated: string[];
}

/**
 * Upgrades student_skills for every skill a completed project covers.
 * Same evidence-rank, never-downgrade approach as the resume and GitHub
 * merges (claimed/inferred/assessed -> demonstrated; already-demonstrated
 * skills are left untouched, just reinforced).
 */
export async function mergeProjectEvidenceIntoStudentSkills(
  supabase: SupabaseClient,
  profileId: string,
  skills: string[],
): Promise<ProjectSkillMergeResult> {
  const { data: existingSkills } = await supabase
    .from("student_skills")
    .select("id, skill_id, custom_skill_name, level, evidence_type, confidence, skills(name)")
    .eq("profile_id", profileId);

  const existingByName = new Map(
    (existingSkills ?? []).map((row) => [
      (row.custom_skill_name ?? (row.skills as unknown as { name: string } | null)?.name ?? "").toLowerCase(),
      row,
    ]),
  );

  const now = new Date().toISOString();
  const newlyDemonstrated: string[] = [];
  const derivedLevel = confidenceToLevel(PROJECT_COMPLETION_CONFIDENCE);

  for (const skillName of skills) {
    const key = skillName.toLowerCase();
    const existing = existingByName.get(key);

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
          confidence: Math.max(existing.confidence, PROJECT_COMPLETION_CONFIDENCE),
          last_updated_at: now,
        })
        .eq("id", existing.id);
      if (!wasDemonstrated) newlyDemonstrated.push(skillName);
    } else {
      const skillId = await resolveSkillId(supabase, skillName);
      await supabase.from("student_skills").insert({
        profile_id: profileId,
        skill_id: skillId,
        level: derivedLevel,
        evidence_type: "demonstrated",
        confidence: PROJECT_COMPLETION_CONFIDENCE,
      });
      newlyDemonstrated.push(skillName);
    }
  }

  return { newlyDemonstrated };
}
