import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { LoginButton } from "@/components/auth/login-button";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link className="flex items-center gap-2 font-semibold tracking-tight" href="/">
          <span className="grid size-8 place-items-center rounded-lg bg-cyan-400 text-slate-950">
            <Compass className="size-5" aria-hidden="true" />
          </span>
          SkillBridge AI
        </Link>
        <LoginButton />
      </nav>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-28">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
            <Sparkles className="size-4" aria-hidden="true" />
            Your adaptive career GPS
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
            Build a career path that responds to real life.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            SkillBridge turns your current skills, goals, and available time into a focused path toward interview-ready proof.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <div className="inline-flex items-center gap-2"><LoginButton /><ArrowRight className="size-4 text-cyan-200" aria-hidden="true" /></div>
            <Link className="inline-flex items-center rounded-lg border border-slate-700 px-5 py-3 font-medium text-slate-100 transition hover:border-slate-500" href="/roadmap">
              Explore a roadmap
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/30">
          <p className="text-sm font-medium text-cyan-200">Career Twin preview</p>
          <h2 className="mt-2 text-2xl font-semibold">Frontend Engineer</h2>
          <div className="mt-7 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-[34%] rounded-full bg-cyan-300" />
          </div>
          <div className="mt-3 flex justify-between text-sm text-slate-400"><span>Current readiness</span><span>34%</span></div>
          <div className="mt-7 space-y-3">
            {["Prove React state-management skills", "Build and deploy a portfolio project", "Practice role-specific interviews"].map((item, index) => (
              <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4" key={item}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-sm font-medium text-cyan-200">{index + 1}</span>
                <p className="text-sm text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
