"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GithubAnalyzerForm({ existingUsername }: { existingUsername?: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState(existingUsername ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Enter a GitHub username first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/github/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not analyze this GitHub profile.");
      router.refresh();
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <label htmlFor="github-username" className="text-sm font-medium text-slate-300">
        GitHub username
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <Code2 className="size-4 text-slate-500" aria-hidden="true" />
          <input
            id="github-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. octocat"
            disabled={loading}
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
        </div>
        <Button onClick={handleAnalyze} disabled={loading} className="gap-2 whitespace-nowrap">
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Code2 className="size-4" aria-hidden="true" />}
          {loading ? "Analyzing…" : existingUsername ? "Re-analyze" : "Analyze"}
        </Button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
