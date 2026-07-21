import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assessmentStartSchema } from "@/lib/validations/assessment";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = assessmentStartSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid skill and assessment type are required." }, { status: 400 });
  }
  const { skill, assessmentType } = parsed.data;

  const { data: skillRow } = await supabase.from("skills").select("id").ilike("name", skill).maybeSingle();
  const skillId =
    skillRow?.id ??
    (
      await supabase.from("skills").insert({ name: skill, category: "custom" }).select("id").single()
    ).data?.id;
  if (!skillId) {
    return NextResponse.json({ error: `Could not resolve skill "${skill}".` }, { status: 500 });
  }

  const { data: assessment, error } = await supabase
    .from("assessments")
    .insert({
      profile_id: user.id,
      skill_id: skillId,
      assessment_type: assessmentType,
      score: 0,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error || !assessment) {
    return NextResponse.json({ error: error?.message ?? "Could not start assessment." }, { status: 500 });
  }

  return NextResponse.json({ assessmentId: assessment.id, skill, assessmentType, status: "in_progress" });
}
