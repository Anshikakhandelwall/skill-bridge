import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeUploader } from "@/components/resume/resume-uploader";

export default async function ResumePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, file_name, created_at, analysis_json")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="animate-fade-in-up">
          <p className="text-sm font-medium text-cyan-200">SkillBridge AI</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Upload your resume</h1>
          <p className="mt-2 text-slate-400">
            We&apos;ll extract your skills and separate what you&apos;ve proven from what you&apos;ve only claimed.
          </p>
        </div>

        <div className="mt-8">
          <ResumeUploader />
        </div>

        {resumes && resumes.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-medium text-slate-300">Previously uploaded</p>
            <ul className="mt-3 space-y-2">
              {resumes.map((resume) => (
                <li
                  key={resume.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm"
                >
                  <span className="text-slate-200">{resume.file_name}</span>
                  <span className="text-slate-500">
                    {resume.analysis_json ? "Analyzed" : "Not analyzed"} ·{" "}
                    {new Date(resume.created_at).toLocaleDateString()}
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
