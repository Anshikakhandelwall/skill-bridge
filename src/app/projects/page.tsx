import { redirect } from "next/navigation";
import { FolderGit2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GenerateProjectButton } from "@/components/projects/generate-project-button";
import { ProjectCard, type ProjectCardData } from "@/components/projects/project-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, difficulty, estimated_hours, status, project_json, github_url, created_at, completed_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-sm font-medium text-cyan-200">Project Coach</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Turn skill gaps into portfolio projects</h1>
            <p className="mt-2 text-slate-400">
              Each project is built from your highest-priority skill gaps — portfolio-quality, not a to-do app.
            </p>
          </div>
          <GenerateProjectButton />
        </div>

        {(!projects || projects.length === 0) && (
          <EmptyState
            icon={FolderGit2}
            title="No projects yet"
            description="Generate a portfolio-quality project built from your highest-priority skill gaps."
          >
            <div className="mt-5 flex justify-center">
              <GenerateProjectButton />
            </div>
          </EmptyState>
        )}

        <div className="space-y-6">
          {(projects ?? []).map((project) => (
            <ProjectCard key={project.id} project={project as unknown as ProjectCardData} />
          ))}
        </div>
      </div>
    </main>
  );
}
