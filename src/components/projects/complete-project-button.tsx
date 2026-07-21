"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Celebration } from "@/components/ui/celebration";

export function CompleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: githubUrl.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not mark this project complete.");
      setCelebrate(true);
      router.refresh();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
      <label htmlFor={`github-url-${projectId}`} className="sr-only">
        GitHub or deployment link
      </label>
      <input
        id={`github-url-${projectId}`}
        type="url"
        value={githubUrl}
        onChange={(event) => setGithubUrl(event.target.value)}
        placeholder="GitHub or deployment link (optional)"
        disabled={loading}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
      />
      <Button onClick={handleComplete} disabled={loading} variant="outline" className="w-full gap-2">
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
        Mark complete
      </Button>
      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
      <Celebration active={celebrate} message="Project complete — nice work!" onDismiss={() => setCelebrate(false)} />
    </div>
  );
}
