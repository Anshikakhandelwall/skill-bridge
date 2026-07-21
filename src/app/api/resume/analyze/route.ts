import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeResumeText } from "@/lib/agents/resume-analyst";
import { ResumeExtractionError, extractTextFromPdf } from "@/lib/resume/extract-text";
import { computeReadinessScore, confidenceToLevel } from "@/lib/resume/readiness-score";
import { resumeIdSchema, type ResumeAnalysis } from "@/lib/validations/resume";
import { adaptRoadmap } from "@/lib/career/orchestrator";

type CurrentSkill = { name: string; level: number; confidence?: number; evidence_type?: string };

/** Ensures resume text exists, extracting it from storage if a prior step skipped that. */
async function ensureExtractedText(
  supabase: SupabaseClient,
  resume: { id: string; file_path: string; extracted_text: string | null },
): Promise<string> {
  if (resume.extracted_text?.trim()) return resume.extracted_text;

  const { data: file, error: downloadError } = await supabase.storage
    .from("resumes")
    .download(resume.file_path);
  if (downloadError || !file) {
    throw new ResumeExtractionError("invalid_pdf", "Could not read the stored resume file.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);
  await supabase.from("resumes").update({ extracted_text: text }).eq("id", resume.id);
  return text;
}

/** Merges resume-derived skill evidence into the Career Twin's existing skill list. */
function mergeCurrentSkills(existing: CurrentSkill[], analysis: ResumeAnalysis): CurrentSkill[] {
  const byName = new Map<string, CurrentSkill>();
  for (const skill of existing) {
    if (skill?.name) byName.set(skill.name.toLowerCase(), { ...skill });
  }
  for (const skill of analysis.skills) {
    const key = skill.name.toLowerCase();
    const prior = byName.get(key);
    byName.set(key, {
      name: prior?.name ?? skill.name,
      level: Math.max(prior?.level ?? 0, confidenceToLevel(skill.confidence)),
      confidence: Math.max(prior?.confidence ?? 0, skill.confidence),
      evidence_type: skill.evidence_type === "demonstrated" ? "demonstrated" : prior?.evidence_type ?? "claimed",
    });
  }
  return Array.from(byName.values());
}

/** Upgrades/creates student_skills rows from resume evidence. */
async function syncStudentSkills(supabase: SupabaseClient, profileId: string, analysis: ResumeAnalysis) {
  const [{ data: librarySkills }, { data: existingSkills }] = await Promise.all([
    supabase.from("skills").select("id, name"),
    supabase.from("student_skills").select("id, skill_id, custom_skill_name, evidence_type").eq("profile_id", profileId),
  ]);

  const libraryIdByName = new Map((librarySkills ?? []).map((skill) => [skill.name.toLowerCase(), skill.id]));
  const libraryNameById = new Map((librarySkills ?? []).map((skill) => [skill.id, skill.name]));
  const existingByName = new Map(
    (existingSkills ?? []).map((row) => [
      (row.custom_skill_name ?? libraryNameById.get(row.skill_id) ?? "").toLowerCase(),
      row,
    ]),
  );

  const inserts: {
    profile_id: string;
    skill_id: string | null;
    custom_skill_name: string | null;
    level: number;
    evidence_type: string;
    confidence: number;
  }[] = [];

  for (const skill of analysis.skills) {
    const key = skill.name.toLowerCase();
    const level = confidenceToLevel(skill.confidence);
    const existing = existingByName.get(key);

    if (existing) {
      const upgradedEvidenceType = skill.evidence_type === "demonstrated" ? "demonstrated" : existing.evidence_type;
      await supabase
        .from("student_skills")
        .update({
          evidence_type: upgradedEvidenceType,
          confidence: skill.confidence,
          level: Math.max(level, 0),
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      continue;
    }

    const libraryId = libraryIdByName.get(key) ?? null;
    inserts.push({
      profile_id: profileId,
      skill_id: libraryId,
      custom_skill_name: libraryId ? null : skill.name,
      level,
      evidence_type: skill.evidence_type,
      confidence: skill.confidence,
    });
  }

  if (inserts.length) {
    await supabase.from("student_skills").insert(inserts);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = resumeIdSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid resumeId is required." }, { status: 400 });
  }
  const { resumeId } = parsed.data;

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("id, file_path, extracted_text")
    .eq("id", resumeId)
    .eq("profile_id", user.id)
    .single();
  if (resumeError || !resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  const { data: careerTwin } = await supabase
    .from("career_twins")
    .select("current_skills")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!careerTwin) {
    return NextResponse.json(
      { error: "Complete onboarding before analyzing a resume." },
      { status: 400 },
    );
  }

  let resumeText: string;
  try {
    resumeText = await ensureExtractedText(supabase, resume);
  } catch (error) {
    if (error instanceof ResumeExtractionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to prepare resume text for analysis." }, { status: 500 });
  }

  let analysis: ResumeAnalysis;
  try {
    analysis = await analyzeResumeText(resumeText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume analysis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const readinessScore = computeReadinessScore(analysis);
  const now = new Date().toISOString();

  const { error: resumeUpdateError } = await supabase
    .from("resumes")
    .update({ analysis_json: analysis })
    .eq("id", resumeId)
    .eq("profile_id", user.id);
  if (resumeUpdateError) {
    return NextResponse.json({ error: resumeUpdateError.message }, { status: 500 });
  }

  const mergedSkills = mergeCurrentSkills((careerTwin.current_skills as CurrentSkill[] | null) ?? [], analysis);

  const { error: twinUpdateError } = await supabase
    .from("career_twins")
    .update({
      current_skills: mergedSkills,
      missing_skills: analysis.missing_skills,
      evidence_summary: {
        summary: analysis.summary,
        strengths: analysis.strengths,
        recommended_roles: analysis.recommended_roles,
        projects: analysis.projects,
        source_resume_id: resumeId,
      },
      current_readiness_score: readinessScore,
      last_analyzed_at: now,
      updated_at: now,
    })
    .eq("profile_id", user.id);
  if (twinUpdateError) {
    return NextResponse.json({ error: twinUpdateError.message }, { status: 500 });
  }

  await syncStudentSkills(supabase, user.id, analysis);

  await supabase.from("career_events").insert({
    profile_id: user.id,
    event_type: "resume.analyzed",
    payload_json: { resume_id: resumeId, readiness_score: readinessScore, skill_count: analysis.skills.length },
  });

  // If a roadmap already exists, let the orchestrator decide whether the new
  // evidence warrants adapting it. Never let this block the resume result.
  let adaptation;
  try {
    adaptation = await adaptRoadmap(supabase, user.id, { type: "resume.analyzed" });
  } catch (error) {
    console.error("Roadmap adaptation after resume analysis failed:", error);
  }

  return NextResponse.json({ resumeId, analysis, readinessScore, adaptation });
}
