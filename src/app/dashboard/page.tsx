import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [profileResult, goalResult, skillsResult, twinResult] = await Promise.all([
    supabase.from("profiles").select("full_name, weekly_hours").eq("id", user.id).single(),
    supabase.from("career_goals").select("target_role").eq("profile_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("student_skills").select("level, custom_skill_name, skills(name)").eq("profile_id", user.id),
    supabase.from("career_twins").select("current_readiness_score, roadmap_status").eq("profile_id", user.id).maybeSingle(),
  ]);
  const skills = (skillsResult.data ?? []).map((skill) => skill.custom_skill_name ?? (skill.skills as unknown as { name: string } | null)?.name).filter(Boolean);
  const hasTwin = Boolean(twinResult.data);
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10"><div className="mx-auto max-w-5xl"><p className="text-sm text-cyan-200">Career Twin dashboard</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {profileResult.data?.full_name ?? "student"}</h1><p className="mt-2 text-slate-400">Your baseline is ready. AI analysis and roadmap generation come next.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Card label="Career goal" value={goalResult.data?.target_role ?? "Not set"} /><Card label="Weekly hours" value={profileResult.data?.weekly_hours ? `${profileResult.data.weekly_hours} hours` : "Not set"} /><Card label="Career Twin status" value={hasTwin ? "Created" : "In progress"} /><Card label="Roadmap status" value={twinResult.data?.roadmap_status === "generated" ? "Generated" : "Not generated"} /><Card label="Readiness score" value={`${twinResult.data?.current_readiness_score ?? 0}%`} /><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-sm text-slate-400">Current skills</p><div className="mt-3 flex flex-wrap gap-2">{skills.length ? skills.map((skill) => <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-sm text-cyan-100" key={skill}>{skill}</span>) : <span className="text-sm text-slate-300">No skills added yet</span>}</div></div></div></div></main>;
}

function Card({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>; }
