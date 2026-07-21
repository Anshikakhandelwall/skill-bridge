import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateInterviewAnswers } from "@/lib/agents/interview-agent";
import { completeAssessment } from "@/lib/career/assessment";
import { loadSkillGapContext } from "@/lib/career/load-gap-context";
import { adaptRoadmap } from "@/lib/career/orchestrator";
import { recordCareerEvent } from "@/lib/career/events";
import { interviewRespondSchema, type InterviewDifficulty, type InterviewQuestion } from "@/lib/validations/interview";
import type { CareerTwinSkillRow } from "@/lib/career/skill-gap";

const WEAK_ASSESSMENT_THRESHOLD = 70;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: interviewId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = interviewRespondSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "At least one answer is required." }, { status: 400 });
  }
  const { answers } = parsed.data;

  const { data: session, error: fetchError } = await supabase
    .from("interview_sessions")
    .select("id, target_role, difficulty, status, questions_json")
    .eq("id", interviewId)
    .eq("profile_id", user.id)
    .single();
  if (fetchError || !session) {
    return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
  }
  if (session.status === "completed") {
    return NextResponse.json({ error: "This interview has already been completed." }, { status: 409 });
  }

  const questions = session.questions_json as InterviewQuestion[];
  const { data: careerTwin } = await supabase
    .from("career_twins")
    .select("current_readiness_score")
    .eq("profile_id", user.id)
    .maybeSingle();
  const previousReadinessScore = careerTwin?.current_readiness_score ?? 0;

  let feedback;
  try {
    feedback = await evaluateInterviewAnswers({
      targetRole: session.target_role,
      difficulty: session.difficulty as InterviewDifficulty,
      readinessScore: previousReadinessScore,
      questions,
      answers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not evaluate interview answers.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("interview_sessions")
    .update({ answers_json: answers, feedback_json: feedback, overall_score: feedback.overall_score, status: "completed", completed_at: now })
    .eq("id", interviewId)
    .eq("profile_id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Reuse the existing assessment engine for every skill the interview probed —
  // each skill_evaluation is scored/logged exactly like a mock-coding assessment,
  // upgrading student_skills evidence (claimed/inferred -> assessed) via the
  // same never-downgrade rules, without duplicating that logic here.
  const weakSkills: string[] = [];
  for (const evaluation of feedback.skill_evaluations) {
    const result = await completeAssessment(supabase, {
      profileId: user.id,
      skillName: evaluation.skill,
      assessmentType: "mock_coding",
      score: evaluation.score,
      confidence: evaluation.score,
    });
    if (evaluation.assessment === "weak" || evaluation.score < WEAK_ASSESSMENT_THRESHOLD || !result.passed) {
      weakSkills.push(evaluation.skill);
    }
  }

  let readinessScore = previousReadinessScore;
  const gapResult = await loadSkillGapContext(supabase, user.id, session.target_role, [] as CareerTwinSkillRow[]);
  if (gapResult.ok) readinessScore = gapResult.context.readinessScore;
  const readinessDelta = readinessScore - previousReadinessScore;

  await supabase
    .from("career_twins")
    .update({ current_readiness_score: readinessScore, updated_at: now })
    .eq("profile_id", user.id);

  await recordCareerEvent(supabase, user.id, "interview.completed", {
    interview_id: interviewId,
    target_role: session.target_role,
    overall_score: feedback.overall_score,
    weak_skills: weakSkills,
    readiness_delta: readinessDelta,
    questions_count: questions.length,
  });

  const adaptation = await adaptRoadmap(supabase, user.id, {
    type: "interview.completed",
    weakSkills,
    readinessDelta,
  });

  return NextResponse.json({
    interviewId,
    feedback,
    readinessScore,
    previousReadinessScore,
    readinessDelta,
    weakSkills,
    adaptation,
  });
}
