import { Clock, Link2 } from "lucide-react";
import { CompleteProjectButton } from "@/components/projects/complete-project-button";
import type { ProjectPlan } from "@/lib/validations/project";

export interface ProjectCardData {
  id: string;
  title: string;
  difficulty: string;
  estimated_hours: number;
  status: string;
  project_json: ProjectPlan;
  github_url: string | null;
  created_at: string;
  completed_at: string | null;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner: "bg-emerald-400/10 text-emerald-300",
  intermediate: "bg-amber-400/10 text-amber-200",
  advanced: "bg-rose-400/10 text-rose-300",
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const plan = project.project_json;
  const isCompleted = project.status === "completed";
  const progress = isCompleted ? 100 : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{project.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{plan.summary}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${DIFFICULTY_STYLES[project.difficulty] ?? "bg-slate-700/50 text-slate-300"}`}>
          {project.difficulty}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" /> {project.estimated_hours}h estimated
        </span>
        {project.github_url && (
          <a href={project.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan-300 hover:underline">
            <Link2 className="size-3.5" aria-hidden="true" /> View project
          </a>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full ${isCompleted ? "bg-emerald-400" : "bg-cyan-300"}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {plan.skills.map((skill) => (
          <span key={skill} className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
            {skill}
          </span>
        ))}
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm font-medium text-slate-300 group-open:text-cyan-200">Milestones</summary>
        <div className="mt-3 space-y-3">
          {plan.milestones.map((milestone) => (
            <div key={milestone.title} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm font-medium text-slate-100">{milestone.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{milestone.description}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                {milestone.tasks.map((task) => (
                  <li key={task}>· {task}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-medium text-slate-300 group-open:text-cyan-200">README preview</summary>
        <pre className="mt-3 max-h-56 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          {plan.readme_template}
        </pre>
      </details>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-medium text-slate-300 group-open:text-cyan-200">Interview questions</summary>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
          {plan.interview_questions.map((question) => (
            <li key={question}>· {question}</li>
          ))}
        </ul>
      </details>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resume bullet</p>
        <p className="mt-1 text-sm italic text-slate-300">&ldquo;{plan.resume_bullet}&rdquo;</p>
      </div>

      {!isCompleted && <CompleteProjectButton projectId={project.id} />}
      {isCompleted && project.completed_at && (
        <p className="mt-4 text-xs text-emerald-300">Completed {new Date(project.completed_at).toLocaleDateString()}</p>
      )}
    </div>
  );
}
