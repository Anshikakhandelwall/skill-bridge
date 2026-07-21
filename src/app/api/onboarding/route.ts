import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { onboardingPayloadSchema } from "@/lib/validations/onboarding";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileResult, goalResult, skillsResult, twinResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("career_goals").select("*").eq("profile_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("student_skills").select("level, custom_skill_name, skills(name)").eq("profile_id", user.id),
    supabase.from("career_twins").select("*").eq("profile_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({ profile: profileResult.data, goal: goalResult.data, skills: skillsResult.data ?? [], careerTwin: twinResult.data });
}

export async function PUT(request: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: profileError } = await ensureProfile(
  supabase,
  user.id,
  user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
);

if (profileError) {
  return NextResponse.json({ error: profileError }, { status: 500 });
}

  const parsed = onboardingPayloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid onboarding data", details: parsed.error.flatten() }, { status: 400 });
  const { profile, goal, skills, completed } = parsed.data;

  if (profile) {
    const { error } = await supabase.from("profiles").update({
      full_name: profile.fullName, college_university: profile.collegeUniversity, degree: profile.degree,
      graduation_year: profile.graduationYear, current_semester: profile.currentSemester,
      weekly_hours: profile.weeklyHours, workload_level: profile.workloadLevel, interests: profile.interests,
    }).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let activeGoalId: string | undefined;
  if (goal) {
    const targetRole = goal.targetRole === "Custom Goal" ? goal.customGoal! : goal.targetRole;
    const { data: existingGoal } = await supabase.from("career_goals").select("id").eq("profile_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const goalValues = { target_role: targetRole, target_date: goal.targetDate, learning_style: goal.learningStyle };
    const result = existingGoal
      ? await supabase.from("career_goals").update(goalValues).eq("id", existingGoal.id).select("id").single()
      : await supabase.from("career_goals").insert({ ...goalValues, profile_id: user.id }).select("id").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    activeGoalId = result.data.id;
  }

  if (skills) {
    const { data: librarySkills, error: libraryError } = await supabase.from("skills").select("id, name");
    if (libraryError) return NextResponse.json({ error: libraryError.message }, { status: 500 });
    const idsByName = new Map(librarySkills.map((skill) => [skill.name.toLowerCase(), skill.id]));
    const entries = skills.map((skill) => ({
      profile_id: user.id,
      skill_id: skill.isCustom ? null : idsByName.get(skill.name.toLowerCase()) ?? null,
      custom_skill_name: skill.isCustom || !idsByName.has(skill.name.toLowerCase()) ? skill.name : null,
      level: ({ beginner: 1, intermediate: 3, advanced: 5 } as const)[skill.level],
      evidence_type: "claimed",
      confidence: 25,
    }));
    if (entries.some((entry) => !entry.skill_id && !entry.custom_skill_name)) return NextResponse.json({ error: "Choose a valid skill name." }, { status: 400 });
    const { error: deleteError } = await supabase.from("student_skills").delete().eq("profile_id", user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    if (entries.length) {
      const { error: insertError } = await supabase.from("student_skills").insert(entries);
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  if (completed) {
    const [{ data: latestProfile }, { data: latestGoal }, { data: latestSkills }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      activeGoalId ? supabase.from("career_goals").select("id").eq("id", activeGoalId).single() : supabase.from("career_goals").select("id").eq("profile_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("student_skills").select("level, custom_skill_name, skills(name)").eq("profile_id", user.id),
    ]);
    if (!latestProfile || !latestGoal) return NextResponse.json({ error: "Complete your profile and goal before continuing." }, { status: 400 });
    const currentSkills = (latestSkills ?? []).map((skill) => ({ name: skill.custom_skill_name ?? (skill.skills as unknown as { name: string } | null)?.name, level: skill.level }));
    const { error: twinError } = await supabase.from("career_twins").upsert({
      profile_id: user.id, career_goal_id: latestGoal.id,
      personal_profile: { fullName: latestProfile.full_name, collegeUniversity: latestProfile.college_university, degree: latestProfile.degree, graduationYear: latestProfile.graduation_year, currentSemester: latestProfile.current_semester },
      current_skills: currentSkills, weekly_hours: latestProfile.weekly_hours, interests: latestProfile.interests,
      current_readiness_score: 0, missing_skills: [], roadmap_status: "not_generated", updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
    if (twinError) return NextResponse.json({ error: twinError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
