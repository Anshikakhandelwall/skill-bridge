"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/onboarding/progress-indicator";
import { SkillSelector } from "@/components/onboarding/skill-selector";
import { goalSchema, profileSchema, type OnboardingFormData } from "@/lib/validations/onboarding";

const emptyForm: OnboardingFormData = { fullName: "", collegeUniversity: "", degree: "", graduationYear: new Date().getFullYear() + 1, currentSemester: 1, weeklyHours: 8, workloadLevel: "medium", interests: [], targetRole: "Frontend Developer", customGoal: "", targetDate: "", learningStyle: "mixed", skills: [] };
const interests = ["Design", "Web development", "Data", "AI", "Problem solving", "Open source", "Startups", "Cybersecurity"];

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium text-slate-200"><span>{label}</span>{children}</label>; }
const inputClass = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300";

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingFormData>(emptyForm);
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/onboarding").then(async (response) => {
      if (!response.ok) throw new Error("Could not load onboarding data.");
      const data = await response.json();
      if (data.profile) setForm((current) => ({ ...current, fullName: data.profile.full_name ?? "", collegeUniversity: data.profile.college_university ?? "", degree: data.profile.degree ?? "", graduationYear: data.profile.graduation_year ?? current.graduationYear, currentSemester: data.profile.current_semester ?? current.currentSemester, weeklyHours: data.profile.weekly_hours ?? current.weeklyHours, workloadLevel: data.profile.workload_level ?? current.workloadLevel, interests: data.profile.interests ?? [] }));
      if (data.goal) setForm((current) => {
        const standardRoles = ["Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "Cyber Security", "UI/UX Designer"];
        const isCustomGoal = !standardRoles.includes(data.goal.target_role);
        return { ...current, targetRole: isCustomGoal ? "Custom Goal" : data.goal.target_role, customGoal: isCustomGoal ? data.goal.target_role : "", targetDate: data.goal.target_date ?? "", learningStyle: data.goal.learning_style ?? current.learningStyle };
      });
      if (data.skills) setForm((current) => ({ ...current, skills: data.skills.map((skill: { level: number; custom_skill_name: string | null; skills: { name: string } | null }) => ({ name: skill.custom_skill_name ?? skill.skills?.name ?? "", level: skill.level <= 1 ? "beginner" : skill.level >= 5 ? "advanced" : "intermediate", isCustom: Boolean(skill.custom_skill_name) })).filter((skill: { name: string }) => Boolean(skill.name)) }));
    }).catch((loadError: Error) => setError(loadError.message)).finally(() => setHydrated(true));
  }, []);

  async function save(payload: object) {
    setIsSaving(true); setError(null);
    const response = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) throw new Error(result.error ?? "Could not save your progress.");
  }

  useEffect(() => {
    if (!hydrated || step === 4) return;
    const timer = setTimeout(() => {
      const payload = step === 1 && profileSchema.safeParse(form).success ? { profile: form } : step === 2 && goalSchema.safeParse(form).success ? { goal: form } : step === 3 ? { skills: form.skills } : null;
      if (payload) save(payload).catch((saveError: Error) => setError(saveError.message));
    }, 700);
    return () => clearTimeout(timer);
  }, [form, step, hydrated]);

  function update<K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function next() {
    try {
      setError(null);
      if (step === 1) { const result = profileSchema.safeParse(form); if (!result.success) throw new Error("Please complete every profile field before continuing."); await save({ profile: result.data }); }
      if (step === 2) { const result = goalSchema.safeParse(form); if (!result.success) throw new Error("Choose a goal, target date, and learning style."); await save({ goal: result.data }); }
      if (step === 3) { if (!form.skills.length) throw new Error("Add at least one current skill."); await save({ skills: form.skills, completed: true }); }
      setStep((current) => current + 1);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Could not save your progress."); }
  }

  if (!hydrated) return <div className="grid min-h-[60vh] place-items-center text-slate-300"><Loader2 className="size-6 animate-spin" /></div>;

  return <section className="mx-auto min-h-screen max-w-2xl px-6 py-12 text-slate-50"><div className="mb-8"><p className="text-sm font-medium text-cyan-200">SkillBridge AI</p><h1 className="mt-2 text-3xl font-semibold">Create your Career Twin</h1><p className="mt-2 text-slate-400">A few focused details help us personalize your starting point.</p></div><ProgressIndicator currentStep={step} totalSteps={4} />
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      {step === 1 && <div className="space-y-5"><h2 className="text-xl font-semibold">Tell us about your studies</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={inputClass} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} /></Field><Field label="College / University"><input className={inputClass} value={form.collegeUniversity} onChange={(e) => update("collegeUniversity", e.target.value)} /></Field><Field label="Degree"><input className={inputClass} placeholder="B.Tech Computer Science" value={form.degree} onChange={(e) => update("degree", e.target.value)} /></Field><Field label="Graduation year"><input className={inputClass} type="number" value={form.graduationYear} onChange={(e) => update("graduationYear", Number(e.target.value))} /></Field><Field label="Current semester"><input className={inputClass} type="number" value={form.currentSemester} onChange={(e) => update("currentSemester", Number(e.target.value))} /></Field><Field label="Available hours / week"><input className={inputClass} type="number" value={form.weeklyHours} onChange={(e) => update("weeklyHours", Number(e.target.value))} /></Field></div><Field label="Academic workload"><div className="grid grid-cols-3 gap-2">{["low", "medium", "high"].map((level) => <button type="button" onClick={() => update("workloadLevel", level as OnboardingFormData["workloadLevel"])} className={`rounded-lg border px-3 py-2 capitalize ${form.workloadLevel === level ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-300"}`} key={level}>{level}</button>)}</div></Field><Field label="What interests you?"><div className="flex flex-wrap gap-2">{interests.map((interest) => <button type="button" onClick={() => update("interests", form.interests.includes(interest) ? form.interests.filter((item) => item !== interest) : [...form.interests, interest])} className={`rounded-full border px-3 py-1.5 text-sm ${form.interests.includes(interest) ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-300"}`} key={interest}>{interest}</button>)}</div></Field></div>}
      {step === 2 && <div className="space-y-5"><h2 className="text-xl font-semibold">Choose your next career goal</h2><Field label="Target role"><select className={inputClass} value={form.targetRole} onChange={(e) => update("targetRole", e.target.value as OnboardingFormData["targetRole"])}>{["Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "Cyber Security", "UI/UX Designer", "Custom Goal"].map((role) => <option key={role}>{role}</option>)}</select></Field>{form.targetRole === "Custom Goal" && <Field label="Your custom goal"><input className={inputClass} value={form.customGoal} onChange={(e) => update("customGoal", e.target.value)} placeholder="e.g. Product Manager" /></Field>}<Field label="Target date"><input className={inputClass} type="date" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)} /></Field><Field label="How do you prefer to learn?"><div className="grid gap-2 sm:grid-cols-2">{[["videos", "Videos"], ["reading", "Reading"], ["building_projects", "Building Projects"], ["mixed", "Mixed"]].map(([value, label]) => <button type="button" key={value} onClick={() => update("learningStyle", value as OnboardingFormData["learningStyle"])} className={`rounded-lg border px-3 py-3 text-left ${form.learningStyle === value ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-300"}`}>{label}</button>)}</div></Field></div>}
      {step === 3 && <div><h2 className="text-xl font-semibold">What can you do today?</h2><p className="mt-1 text-sm text-slate-400">Add skills you have studied or practiced. You can add your own too.</p><div className="mt-5"><SkillSelector skills={form.skills} onChange={(skills) => update("skills", skills)} /></div></div>}
      {step === 4 && <div className="space-y-6"><div className="flex items-center gap-3"><CheckCircle2 className="size-8 text-cyan-300" /><div><h2 className="text-xl font-semibold">Your Career Twin is ready</h2><p className="text-sm text-slate-400">This is your baseline before roadmap generation.</p></div></div><dl className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">Career goal</dt><dd className="mt-1 font-medium">{form.targetRole === "Custom Goal" ? form.customGoal : form.targetRole}</dd></div><div className="rounded-lg bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">Weekly hours</dt><dd className="mt-1 font-medium">{form.weeklyHours} hours</dd></div><div className="rounded-lg bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">Current readiness</dt><dd className="mt-1 font-medium">0% — awaiting analysis</dd></div><div className="rounded-lg bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">Roadmap</dt><dd className="mt-1 font-medium">Not generated</dd></div></dl><div><p className="text-xs text-slate-400">Current skills</p><div className="mt-2 flex flex-wrap gap-2">{form.skills.map((skill) => <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100" key={skill.name}>{skill.name} · {skill.level}</span>)}</div></div></div>}
      {error && <p className="mt-6 text-sm text-rose-300" role="alert">{error}</p>}<div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">{step > 1 && step < 4 ? <Button variant="outline" onClick={() => setStep((current) => current - 1)}>Previous</Button> : <span />}{step < 4 ? <Button onClick={next} disabled={isSaving}>{isSaving ? "Saving…" : "Next"}</Button> : <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>}</div>
    </div>
  </section>;
}
