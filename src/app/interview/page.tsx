import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InterviewSession } from "@/components/interview/interview-session";

export default async function InterviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: pastInterviews } = await supabase
    .from("interview_sessions")
    .select("id, target_role, difficulty, status, overall_score, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="animate-fade-in-up">
          <p className="text-sm font-medium text-cyan-200">Interview Coach</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Practice a role-specific mock interview</h1>
          <p className="mt-2 text-slate-400">
            Questions are generated from your Career Twin, roadmap, projects, and GitHub evidence — not generic prep.
          </p>
        </div>

        <InterviewSession />

        {pastInterviews && pastInterviews.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-300">Past interviews</p>
            <ul className="mt-3 space-y-2">
              {pastInterviews.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm"
                >
                  <span className="text-slate-200">
                    {session.target_role} · <span className="capitalize text-slate-400">{session.difficulty}</span>
                  </span>
                  <span className="text-slate-500">
                    {session.status === "completed" ? `${session.overall_score}%` : "In progress"} ·{" "}
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
