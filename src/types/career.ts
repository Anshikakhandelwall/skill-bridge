export type EvidenceType = "claimed" | "inferred" | "assessed" | "demonstrated";

export interface SkillEvidence { skill: string; confidence: number; evidenceType: EvidenceType; }
