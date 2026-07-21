"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Celebration } from "@/components/ui/celebration";

export function GenerateRoadmapButton({ label = "Generate my roadmap" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/roadmap/generate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate a roadmap.");
      setCelebrate(true);
      router.refresh();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleGenerate} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Planning your roadmap…
          </>
        ) : (
          <>
            <Sparkles className="size-4" aria-hidden="true" />
            {label}
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
      <Celebration active={celebrate} message="Your roadmap is ready!" onDismiss={() => setCelebrate(false)} />
    </div>
  );
}
