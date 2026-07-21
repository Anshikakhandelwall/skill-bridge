import type { EvidenceType } from "@/types/career";

/**
 * How much a skill level "counts" toward readiness based on how it was
 * verified. A claimed skill with no supporting evidence is worth far less
 * than one a project or assessment has actually demonstrated.
 */
export const EVIDENCE_WEIGHT: Record<EvidenceType, number> = {
  demonstrated: 1.0,
  assessed: 0.85,
  inferred: 0.6,
  claimed: 0.35,
};

export interface RoleCompetencyRow {
  skillName: string;
  requiredLevel: number; // 1-5
  weight: number; // role_competencies.weight — how much this skill drives readiness for the role
}

export interface StudentSkillRow {
  skillName: string;
  level: number; // 0-5
  evidenceType: EvidenceType;
  confidence: number; // 0-100
}

/** A lighter-weight fallback source: career_twins.current_skills. */
export interface CareerTwinSkillRow {
  name: string;
  level?: number;
  confidence?: number;
  evidence_type?: string;
}

export interface SkillGapInput {
  targetRole: string;
  roleCompetencies: RoleCompetencyRow[];
  studentSkills: StudentSkillRow[];
  careerTwinSkills?: CareerTwinSkillRow[];
}

export interface SkillGapEntry {
  skill: string;
  required: number;
  current: number;
  evidenceType: EvidenceType | "none";
  confidence: number;
  effective: number;
  gap: number;
  weight: number;
  priority: number;
}

export type SkillGapMatrix = SkillGapEntry[];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isEvidenceType(value: string | undefined): value is EvidenceType {
  return value === "claimed" || value === "inferred" || value === "assessed" || value === "demonstrated";
}

/**
 * Computes an evidence-weighted skill gap matrix for a target role.
 *
 * For every skill the role requires, this looks up the student's current
 * level and how that level was verified (student_skills is authoritative;
 * career_twins.current_skills is used only as a fallback in case a skill
 * hasn't been synced there yet), then derives:
 *
 *   effective = current_level * evidence_weight(evidence_type)
 *   gap       = max(0, required_level - effective)
 *   priority  = clamp01((gap / required_level) * role_competency_weight)
 *
 * priority is a 0-1 score combining how large the gap is (relative to what's
 * required) with how important the skill is to the target role, so the
 * Career Planner and UI can both surface the highest-leverage gaps first.
 */
export function calculateSkillGap(input: SkillGapInput): SkillGapMatrix {
  const { roleCompetencies, studentSkills, careerTwinSkills = [] } = input;

  const studentByName = new Map(studentSkills.map((skill) => [skill.skillName.toLowerCase(), skill]));
  const twinByName = new Map(careerTwinSkills.map((skill) => [skill.name.toLowerCase(), skill]));

  const matrix = roleCompetencies.map((competency): SkillGapEntry => {
    const key = competency.skillName.toLowerCase();
    const studentSkill = studentByName.get(key);
    const twinSkill = !studentSkill ? twinByName.get(key) : undefined;

    let currentLevel = 0;
    let evidenceType: EvidenceType | "none" = "none";
    let confidence = 0;

    if (studentSkill) {
      currentLevel = studentSkill.level;
      evidenceType = studentSkill.evidenceType;
      confidence = studentSkill.confidence;
    } else if (twinSkill) {
      currentLevel = twinSkill.level ?? 0;
      evidenceType = isEvidenceType(twinSkill.evidence_type) ? twinSkill.evidence_type : "claimed";
      confidence = twinSkill.confidence ?? 0;
    }

    const evidenceWeight = evidenceType === "none" ? 0 : EVIDENCE_WEIGHT[evidenceType];
    const effective = round2(currentLevel * evidenceWeight);
    const gap = round2(Math.max(0, competency.requiredLevel - effective));
    const gapRatio = competency.requiredLevel > 0 ? gap / competency.requiredLevel : 0;
    const priority = round2(clamp(gapRatio * competency.weight, 0, 1));

    return {
      skill: competency.skillName,
      required: competency.requiredLevel,
      current: currentLevel,
      evidenceType,
      confidence,
      effective,
      gap,
      weight: competency.weight,
      priority,
    };
  });

  return matrix.sort((a, b) => b.priority - a.priority);
}
