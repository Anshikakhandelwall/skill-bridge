"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { OnboardingFormData } from "@/lib/validations/onboarding";

const suggestedSkills = ["Python", "Java", "JavaScript", "React", "Node", "SQL", "Git", "HTML", "CSS", "Machine Learning", "Docker", "Linux"];
type Skill = OnboardingFormData["skills"][number];

export function SkillSelector({ skills, onChange }: { skills: Skill[]; onChange: (skills: Skill[]) => void }) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => suggestedSkills.filter((skill) => skill.toLowerCase().includes(search.toLowerCase())), [search]);
  const addSkill = (name: string, isCustom = false) => { if (!skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) onChange([...skills, { name, level: "beginner", isCustom }]); setSearch(""); };
  return <div className="space-y-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-slate-100 outline-none focus:border-cyan-300" placeholder="Search or add a skill" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="flex flex-wrap gap-2">{visible.map((skill) => <button type="button" className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-cyan-300" onClick={() => addSkill(skill)} key={skill}>+ {skill}</button>)}{search && !suggestedSkills.some((skill) => skill.toLowerCase() === search.toLowerCase()) && <button type="button" className="rounded-full border border-dashed border-cyan-300/60 px-3 py-1.5 text-sm text-cyan-100" onClick={() => addSkill(search, true)}><Plus className="mr-1 inline size-3" />Add “{search}”</button>}</div><div className="space-y-3">{skills.map((skill) => <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3" key={skill.name}><span className="min-w-28 font-medium">{skill.name}</span><select className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" value={skill.level} onChange={(event) => onChange(skills.map((item) => item.name === skill.name ? { ...item, level: event.target.value as Skill["level"] } : item))}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><button type="button" className="ml-auto text-slate-400 hover:text-rose-300" onClick={() => onChange(skills.filter((item) => item.name !== skill.name))} aria-label={`Remove ${skill.name}`}><X className="size-4" /></button></div>)}</div></div>;
}
