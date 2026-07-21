"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { action: "fail_react_assessment", label: "Fail React assessment" },
  { action: "increase_weekly_hours", label: "Increase weekly hours" },
  { action: "change_career_goal", label: "Change career goal" },
  { action: "complete_project", label: "Complete a project" },
] as const;

export function DemoSimulationPanel() {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function trigger(action: string) {
    setLoadingAction(action);
    setMessage(null);
    try {
      const response = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Simulation failed.");
      const adapted = data.adaptation?.adapted;
      setMessage(adapted ? `Roadmap adapted: ${data.adaptation.reason}` : data.adaptation?.reason ?? "Event recorded.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Developer demo mode</p>
      <p className="mt-1 text-sm text-slate-400">
        Trigger real events to see the roadmap adapt live. For hackathon demos only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map(({ action, label }) => (
          <Button
            key={action}
            variant="outline"
            className="gap-2"
            disabled={loadingAction !== null}
            onClick={() => trigger(action)}
          >
            {loadingAction === action && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {label}
          </Button>
        ))}
      </div>
      {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
    </div>
  );
}
