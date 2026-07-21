import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeGithubEvidence } from "@/lib/agents/github-analyst";
import { collectGitHubEvidence, GitHubFetchError } from "@/lib/github/client";
import { mergeGithubEvidenceIntoStudentSkills } from "@/lib/career/github-skill-merge";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import { adaptRoadmap } from "@/lib/career/orchestrator";
import { recordCareerEvent } from "@/lib/career/events";
import { githubUsernameSchema, type GithubAnalysis } from "@/lib/validations/github";
import type { CareerTwinSkillRow } from "@/lib/career/skill-gap";

type CurrentSkill = { name: string; level: number; confidence?: number; evidence_type?: string };

/** Merges GitHub-derived skill evidence into the Career Twin's cached skill list, never downgrading. */
function mergeCurrentSkillsWithGithub(existing: CurrentSkill[], analysis: GithubAnalysis): CurrentSkill[] {
  const byName = new Map<string, CurrentSkill>();
  for (const skill of existing) {
    if (skill?.name) byName.set(skill.name.toLowerCase(), { ...skill });
  }
  for (const skill of analysis.demonstrated_skills) {
    const key = skill.name.toLowerCase();
    const prior = byName.get(key);
    byName.set(key, {
      name: prior?.name ?? skill.name,
      level: Math.max(prior?.level ?? 0, Math.min(5, Math.round(skill.confidence / 20))),
      confidence: Math.max(prior?.confidence ?? 0, skill.confidence),
      evidence_type: "demonstrated",
    });
  }
  for (const skill of analysis.inferred_skills) {
    const key = skill.name.toLowerCase();
    const prior = byName.get(key);
    if (prior?.evidence_type === "demonstrated" || prior?.evidence_type === "assessed") continue; // never downgrade
    byName.set(key, {
      name: prior?.name ?? skill.name,
      level: prior?.level ?? 1,
      confidence: Math.max(prior?.confidence ?? 0, 40),
      evidence_type: prior?.evidence_type === "inferred" ? prior.evidence_type : "inferred",
    });
  }
  return Array.from(byName.values());
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = githubUsernameSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid GitHub username is required." }, { status: 400 });
  }
  const { username } = parsed.data;

  const { data: careerTwin } = await supabase
    .from("career_twins")
    .select("current_skills, missing_skills, evidence_summary, current_readiness_score")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!careerTwin) {
    return NextResponse.json({ error: "Complete onboarding before analyzing a GitHub profile." }, { status: 400 });
  }

  let bundle;
  try {
    bundle = await collectGitHubEvidence(username);
  } catch (error) {
    if (error instanceof GitHubFetchError) {
      const status = error.code === "not_found" ? 404 : error.code === "rate_limited" ? 429 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Failed to fetch GitHub data." }, { status: 502 });
  }

  let analysis: GithubAnalysis;
  try {
    analysis = await analyzeGithubEvidence(bundle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub analysis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { error: profileUpsertError } = await supabase.from("github_profiles").upsert(
    {
      profile_id: user.id,
      username,
      profile_json: bundle,
      analysis_json: analysis,
      last_synced_at: now,
    },
    { onConflict: "profile_id" },
  );
  if (profileUpsertError) {
    return NextResponse.json({ error: profileUpsertError.message }, { status: 500 });
  }

  const { newlyDemonstrated } = await mergeGithubEvidenceIntoStudentSkills(supabase, user.id, analysis);

  const mergedSkills = mergeCurrentSkillsWithGithub((careerTwin.current_skills as CurrentSkill[] | null) ?? [], analysis);
  const previousMissing = (careerTwin.missing_skills as string[] | null) ?? [];
  const newlyDemonstratedLower = new Set(newlyDemonstrated.map((s) => s.toLowerCase()));
  const mergedMissing = Array.from(
    new Set(
      [...previousMissing, ...analysis.missing_portfolio_areas].filter((skill) => !newlyDemonstratedLower.has(skill.toLowerCase())),
    ),
  );
  const mergedEvidenceSummary = {
    ...((careerTwin.evidence_summary as Record<string, unknown> | null) ?? {}),
    github_summary: analysis.summary,
    github_projects: analysis.strongest_projects,
    github_role_adjustments: analysis.recommended_role_adjustments,
    github_username: username,
    github_analyzed_at: now,
  };

  const { data: goal } = await supabase
    .from("career_goals")
    .select("target_role")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousReadinessScore = careerTwin.current_readiness_score ?? 0;
  let readinessScore = previousReadinessScore;
  if (goal) {
    const gapResult = await loadSkillGapContext(supabase, user.id, goal.target_role, mergedSkills as CareerTwinSkillRow[]);
    if (gapResult.ok) readinessScore = gapResult.context.readinessScore;
  }
  const readinessDelta = readinessScore - previousReadinessScore;

  const { error: twinUpdateError } = await supabase
    .from("career_twins")
    .update({
      current_skills: mergedSkills,
      missing_skills: mergedMissing,
      evidence_summary: mergedEvidenceSummary,
      current_readiness_score: readinessScore,
      last_analyzed_at: now,
      updated_at: now,
    })
    .eq("profile_id", user.id);
  if (twinUpdateError) {
    return NextResponse.json({ error: twinUpdateError.message }, { status: 500 });
  }

  await recordCareerEvent(supabase, user.id, "github.analyzed", {
    username,
    new_demonstrated_skills: newlyDemonstrated,
    readiness_delta: readinessDelta,
    repositories_analyzed: bundle.repositories.length,
  });

  let adaptation;
  if (newlyDemonstrated.length > 0 || Math.abs(readinessDelta) >= 5) {
    adaptation = await adaptRoadmap(supabase, user.id, {
      type: "github.analyzed",
      newDemonstratedSkills: newlyDemonstrated,
      readinessDelta,
    });
  }

  return NextResponse.json({
    username,
    profile: bundle.profile,
    repositoriesAnalyzed: bundle.repositories.length,
    analysis,
    readinessScore,
    previousReadinessScore,
    readinessDelta,
    newlyDemonstrated,
    adaptation,
  });
}
