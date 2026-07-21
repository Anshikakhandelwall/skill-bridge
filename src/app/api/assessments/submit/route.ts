import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeAssessment, type AssessmentType } from "@/lib/career/assessment";
import { adaptRoadmap } from "@/lib/career/orchestrator";
import { assessmentSubmitSchema } from "@/lib/validations/assessment";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = assessmentSubmitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid assessmentId and score are required." }, { status: 400 });
  }
  const { assessmentId, score, confidence } = parsed.data;

  const { data: assessment, error: fetchError } = await supabase
    .from("assessments")
    .select("id, assessment_type, status, skills(name)")
    .eq("id", assessmentId)
    .eq("profile_id", user.id)
    .single();
  if (fetchError || !assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }
  if (assessment.status === "completed") {
    return NextResponse.json({ error: "This assessment has already been submitted." }, { status: 409 });
  }
  const skillName = (assessment.skills as unknown as { name: string } | null)?.name;
  if (!skillName) {
    return NextResponse.json({ error: "Assessment is missing its skill." }, { status: 500 });
  }

  let result;
  try {
    result = await completeAssessment(supabase, {
      profileId: user.id,
      skillName,
      assessmentType: assessment.assessment_type as AssessmentType,
      score,
      confidence,
      assessmentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit assessment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const adaptation = await adaptRoadmap(
    supabase,
    user.id,
    result.passed
      ? { type: "assessment.completed", skill: result.skill, score: result.score }
      : { type: "assessment.failed", skill: result.skill, score: result.score },
  );

  return NextResponse.json({ ...result, adaptation });
}
