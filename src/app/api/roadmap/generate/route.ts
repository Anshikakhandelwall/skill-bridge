import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRoadmapForActiveGoal } from "@/lib/career/generate-roadmap";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await generateRoadmapForActiveGoal(supabase, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ roadmapId: result.roadmapId, readinessScore: result.readinessScore, version: result.version });
}
