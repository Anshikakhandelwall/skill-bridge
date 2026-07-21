import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeAssessment } from "@/lib/career/assessment";
import { recordCareerEvent } from "@/lib/career/events";
import { adaptRoadmap } from "@/lib/career/orchestrator";

const DEMO_ACTIONS = ["fail_react_assessment", "increase_weekly_hours", "change_career_goal", "complete_project"] as const;
type DemoAction = (typeof DEMO_ACTIONS)[number];

const ROLE_ROTATION = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "Machine Learning Engineer",
  "AI Engineer",
  "Cyber Security",
  "UI/UX Designer",
];

/**
 * Developer-only demo triggers for hackathon demos. Each one performs a
 * real mutation (not a fake payload) and runs it through the same
 * orchestrator real events use, so the resulting adaptation is genuine.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action as DemoAction;
  if (!DEMO_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${DEMO_ACTIONS.join(", ")}` }, { status: 400 });
  }

  if (action === "fail_react_assessment") {
    const result = await completeAssessment(supabase, {
      profileId: user.id,
      skillName: "React",
      assessmentType: "technical_quiz",
      score: 40,
    });
    const adaptation = await adaptRoadmap(supabase, user.id, { type: "assessment.failed", skill: "React", score: 40 });
    return NextResponse.json({ action, result, adaptation });
  }

  if (action === "increase_weekly_hours") {
    const { data: profile } = await supabase.from("profiles").select("weekly_hours").eq("id", user.id).single();
    const previousHours = profile?.weekly_hours ?? 10;
    const newHours = previousHours + 5;
    await supabase.from("profiles").update({ weekly_hours: newHours }).eq("id", user.id);
    await recordCareerEvent(supabase, user.id, "weekly_hours.changed", { previous_hours: previousHours, new_hours: newHours });
    const adaptation = await adaptRoadmap(supabase, user.id, { type: "weekly_hours.changed", previousHours, newHours });
    return NextResponse.json({ action, previousHours, newHours, adaptation });
  }

  if (action === "change_career_goal") {
    const { data: currentGoal } = await supabase
      .from("career_goals")
      .select("id, target_role, target_date, learning_style")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!currentGoal) {
      return NextResponse.json({ error: "Set a career goal first." }, { status: 400 });
    }
    const nextRole = ROLE_ROTATION.find((role) => role !== currentGoal.target_role) ?? ROLE_ROTATION[0];

    await supabase.from("career_goals").update({ status: "paused" }).eq("id", currentGoal.id);
    const { data: newGoal, error: goalError } = await supabase
      .from("career_goals")
      .insert({
        profile_id: user.id,
        target_role: nextRole,
        target_date: currentGoal.target_date,
        learning_style: currentGoal.learning_style,
        status: "active",
      })
      .select("id")
      .single();
    if (goalError || !newGoal) {
      return NextResponse.json({ error: goalError?.message ?? "Could not change career goal." }, { status: 500 });
    }
    await supabase.from("career_twins").update({ career_goal_id: newGoal.id }).eq("profile_id", user.id);
    await recordCareerEvent(supabase, user.id, "career_goal.changed", {
      previous_role: currentGoal.target_role,
      new_role: nextRole,
    });
    const adaptation = await adaptRoadmap(supabase, user.id, {
      type: "career_goal.changed",
      previousRole: currentGoal.target_role,
      newRole: nextRole,
    });
    return NextResponse.json({ action, previousRole: currentGoal.target_role, newRole: nextRole, adaptation });
  }

  // complete_project
  const { data: activeRoadmap } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!activeRoadmap) {
    return NextResponse.json({ error: "No active roadmap to complete a task on." }, { status: 400 });
  }
  const { data: nextTask } = await supabase
    .from("roadmap_tasks")
    .select("id, title, milestone_id, roadmap_milestones!inner(sequence)")
    .eq("roadmap_id", activeRoadmap.id)
    .neq("status", "completed")
    .order("sequence", { foreignTable: "roadmap_milestones", ascending: true })
    .limit(1)
    .maybeSingle();
  if (!nextTask) {
    return NextResponse.json({ error: "No pending tasks to complete." }, { status: 400 });
  }
  await supabase.from("roadmap_tasks").update({ status: "completed" }).eq("id", nextTask.id);

  if (nextTask.milestone_id) {
    const { data: siblingTasks } = await supabase.from("roadmap_tasks").select("status").eq("milestone_id", nextTask.milestone_id);
    if (siblingTasks?.every((task) => task.status === "completed")) {
      await supabase.from("roadmap_milestones").update({ status: "completed" }).eq("id", nextTask.milestone_id);
    }
  }

  await recordCareerEvent(supabase, user.id, "project.completed", { task_id: nextTask.id, task_title: nextTask.title });
  const adaptation = await adaptRoadmap(supabase, user.id, { type: "project.completed", taskId: nextTask.id });
  return NextResponse.json({ action, completedTask: nextTask.title, adaptation });
}
