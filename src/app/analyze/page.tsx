import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle, FileText, FileWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resumeAnalysisSchema, type ResumeAnalysis } from "@/lib/validations/resume";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-medium text-cyan-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EvidenceBadge({ demonstrated }: { demonstrated: boolean }) {
  return demonstrated ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      Demonstrated
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Claimed
    </span>
  );
}

export default async function AnalyzePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: resume }, { data: twin }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, file_name, analysis_json, created_at")
      .eq("profile_id", user.id)
      .not("analysis_json", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("career_twins").select("current_readiness_score, last_analyzed_at").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!resume?.analysis_json) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <div className="w-full max-w-md">
          <EmptyState
            icon={FileText}
            title="No resume analyzed yet"
            description="Upload a resume to see your evidence-based skill breakdown."
            ctaLabel="Upload resume"
            ctaHref="/resume"
          />
        </div>
      </main>
    );
  }

  const parsedAnalysis = resumeAnalysisSchema.safeParse(resume.analysis_json);
  if (!parsedAnalysis.success) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <div className="w-full max-w-md">
          <EmptyState
            icon={FileWarning}
            title="Analysis could not be displayed"
            description="Try uploading your resume again."
            ctaLabel="Upload resume"
            ctaHref="/resume"
          />
        </div>
      </main>
    );
  }
  const analysis: ResumeAnalysis = parsedAnalysis.data;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="animate-fade-in-up">
          <p className="text-sm font-medium text-cyan-200">Resume analysis</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Evidence-based skill breakdown</h1>
          <p className="mt-2 text-slate-400">
            From {resume.file_name} · analyzed {new Date(resume.created_at).toLocaleString()}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Readiness score">
            <div className="flex items-center gap-4">
              <ProgressRing value={twin?.current_readiness_score ?? 0} size={84} strokeWidth={7} />
              <p className="text-sm text-slate-400">Temporary estimate based on skill evidence.</p>
            </div>
          </Section>
          <Section title="Summary">
            <p className="text-sm leading-6 text-slate-200">{analysis.summary}</p>
          </Section>
        </div>

        <Section title="Skills evidence">
          <div className="space-y-3">
            {analysis.skills.map((skill) => (
              <div key={skill.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{skill.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{skill.confidence}% confidence</span>
                    <EvidenceBadge demonstrated={skill.evidence_type === "demonstrated"} />
                  </div>
                </div>
                <p className="mt-2 text-sm italic text-slate-400">&ldquo;{skill.evidence}&rdquo;</p>
              </div>
            ))}
            {analysis.skills.length === 0 && (
              <p className="text-sm text-slate-400">No skills were extracted from this resume.</p>
            )}
          </div>
        </Section>

        {analysis.projects.length > 0 && (
          <Section title="Projects found">
            <div className="grid gap-3 sm:grid-cols-2">
              {analysis.projects.map((project) => (
                <div key={project.title} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <p className="font-medium text-slate-100">{project.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{project.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {project.technologies.map((tech) => (
                      <span key={tech} className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-xs text-cyan-100">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Section title="Strengths">
            <ul className="space-y-1.5 text-sm text-slate-200">
              {analysis.strengths.map((strength) => (
                <li key={strength}>· {strength}</li>
              ))}
            </ul>
          </Section>
          <Section title="Missing skills">
            <div className="flex flex-wrap gap-2">
              {analysis.missing_skills.map((skill) => (
                <span key={skill} className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs text-rose-200">
                  {skill}
                </span>
              ))}
              {analysis.missing_skills.length === 0 && <p className="text-sm text-slate-400">None identified.</p>}
            </div>
          </Section>
          <Section title="Recommended roles">
            <div className="flex flex-wrap gap-2">
              {analysis.recommended_roles.map((role) => (
                <span key={role} className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                  {role}
                </span>
              ))}
            </div>
          </Section>
        </div>

        <div className="flex justify-end">
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
