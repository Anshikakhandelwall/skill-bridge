import type { SupabaseClient } from "@supabase/supabase-js";
import { confidenceToLevel } from "@/lib/resume/readiness-score";
import { recordCareerEvent } from "@/lib/career/events";

export const PASS_THRESHOLD = 70;

export const ASSESSMENT_TYPES = ["technical_quiz", "project_evaluation", "mock_coding", "knowledge_check"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export interface CompleteAssessmentInput {
  profileId: string;
  skillName: string;
  assessmentType: AssessmentType;
  score: number;
  confidence?: number;
  /** If set, completes an existing in-progress row from /api/assessments/start. Otherwise creates+completes in one step. */
  assessmentId?: string;
}

export interface CompleteAssessmentResult {
  assessmentId: string;
  skill: string;
  score: number;
  confidence: number;
  passed: boolean;
  level: number;
  evidenceType: "assessed" | "demonstrated";
}

export async function resolveSkillId(supabase: SupabaseClient, skillName: string): Promise<string> {
  const { data: existing } = await supabase
    .from("skills")
    .select("id")
    .ilike("name", skillName)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("skills")
    .insert({ name: skillName, category: "custom" })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Could not resolve skill "${skillName}" for assessment.`);
  }
  return created.id;
}

/**
 * Completes an assessment (scoring it and, if it was left in-progress by
 * /api/assessments/start, marking it done), then upgrades student_skills
 * evidence: claimed → assessed on a completed assessment, with the level
 * moving toward what was actually demonstrated — up on a pass, down on a
 * fail, never downgrading evidence that's already `demonstrated`.
 * Always ends by logging assessment.completed or assessment.failed.
 */
export async function completeAssessment(
  supabase: SupabaseClient,
  input: CompleteAssessmentInput,
): Promise<CompleteAssessmentResult> {
  const score = Math.max(0, Math.min(100, input.score));
  const confidence = Math.max(0, Math.min(100, input.confidence ?? score));
  const passed = score >= PASS_THRESHOLD;
  const skillId = await resolveSkillId(supabase, input.skillName);
  const now = new Date().toISOString();

  let assessmentId = input.assessmentId;
  if (assessmentId) {
    const { error } = await supabase
      .from("assessments")
      .update({ score, confidence, passed, status: "completed", completed_at: now })
      .eq("id", assessmentId)
      .eq("profile_id", input.profileId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("assessments")
      .insert({
        profile_id: input.profileId,
        skill_id: skillId,
        assessment_type: input.assessmentType,
        score,
        confidence,
        passed,
        status: "completed",
        completed_at: now,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save assessment.");
    assessmentId = created.id;
  }

  const { data: existingSkill } = await supabase
    .from("student_skills")
    .select("id, level, evidence_type")
    .eq("profile_id", input.profileId)
    .eq("skill_id", skillId)
    .maybeSingle();

  const derivedLevel = confidenceToLevel(score);
  let finalLevel: number;
  let finalEvidenceType: "assessed" | "demonstrated";

  if (existingSkill) {
    finalLevel = passed ? Math.max(existingSkill.level, derivedLevel) : Math.min(existingSkill.level, derivedLevel);
    finalEvidenceType = existingSkill.evidence_type === "demonstrated" ? "demonstrated" : "assessed";
    await supabase
      .from("student_skills")
      .update({ level: finalLevel, evidence_type: finalEvidenceType, confidence, last_updated_at: now })
      .eq("id", existingSkill.id);
  } else {
    finalLevel = derivedLevel;
    finalEvidenceType = "assessed";
    await supabase.from("student_skills").insert({
      profile_id: input.profileId,
      skill_id: skillId,
      level: finalLevel,
      evidence_type: finalEvidenceType,
      confidence,
    });
  }

  await recordCareerEvent(supabase, input.profileId, passed ? "assessment.completed" : "assessment.failed", {
    assessment_id: assessmentId,
    skill: input.skillName,
    assessment_type: input.assessmentType,
    score,
    confidence,
    passed,
  });

  return { assessmentId: assessmentId!, skill: input.skillName, score, confidence, passed, level: finalLevel, evidenceType: finalEvidenceType };
}
