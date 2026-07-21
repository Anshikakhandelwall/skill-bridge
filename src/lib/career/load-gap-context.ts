import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateReadinessScore } from "@/lib/career/readiness-score";
import {
  calculateSkillGap,
  type CareerTwinSkillRow,
  type RoleCompetencyRow,
  type SkillGapMatrix,
  type StudentSkillRow,
} from "@/lib/career/skill-gap";
import type { EvidenceType } from "@/types/career";

function isEvidenceType(value: string | null | undefined): value is EvidenceType {
  return value === "claimed" || value === "inferred" || value === "assessed" || value === "demonstrated";
}

export interface GapContext {
  roleCompetencies: RoleCompetencyRow[];
  skillGap: SkillGapMatrix;
  readinessScore: number;
}

export type GapContextResult =
  | { ok: true; context: GapContext }
  | { ok: false; error: string };

/**
 * Loads role competencies + student skills for a profile/target role and
 * runs them through the deterministic skill gap engine. Shared by roadmap
 * generation and the adaptation engine so both always compute readiness
 * the same way.
 */
export async function loadSkillGapContext(
  supabase: SupabaseClient,
  profileId: string,
  targetRole: string,
  careerTwinCurrentSkills: CareerTwinSkillRow[] = [],
): Promise<GapContextResult> {
  const { data: competencyRows, error: competencyError } = await supabase
    .from("role_competencies")
    .select("required_level, weight, skills(name)")
    .eq("target_role", targetRole);
  if (competencyError) {
    return { ok: false, error: competencyError.message };
  }

  const roleCompetencies: RoleCompetencyRow[] = (competencyRows ?? [])
    .map((row) => ({
      skillName: (row.skills as unknown as { name: string } | null)?.name ?? "",
      requiredLevel: row.required_level,
      weight: Number(row.weight),
    }))
    .filter((row) => row.skillName);

  if (!roleCompetencies.length) {
    return { ok: false, error: `No competency map exists yet for "${targetRole}". Choose a different target role.` };
  }

  const { data: studentSkillRows } = await supabase
    .from("student_skills")
    .select("level, evidence_type, confidence, custom_skill_name, skills(name)")
    .eq("profile_id", profileId);
  const studentSkills: StudentSkillRow[] = (studentSkillRows ?? [])
    .map((row) => {
      const name = row.custom_skill_name ?? (row.skills as unknown as { name: string } | null)?.name;
      if (!name || !isEvidenceType(row.evidence_type)) return null;
      return {
        skillName: name,
        level: row.level,
        evidenceType: row.evidence_type,
        confidence: Number(row.confidence),
      };
    })
    .filter((row): row is StudentSkillRow => row !== null);

  const skillGap = calculateSkillGap({
    targetRole,
    roleCompetencies,
    studentSkills,
    careerTwinSkills: careerTwinCurrentSkills,
  });
  const readinessScore = calculateReadinessScore(skillGap);

  return { ok: true, context: { roleCompetencies, skillGap, readinessScore } };
}
