import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Map as MapIcon,
  Zap,
  Trophy,
  Target,
  Clock,
  Link2,
  Mic,
  Circle,
} from "lucide-react";
import type { CareerEventRow } from "@/lib/career/notifications";

const EVENT_META: Record<string, { label: string; icon: typeof Circle }> = {
  "resume.analyzed": { label: "Resume analyzed", icon: FileText },
  "roadmap.generated": { label: "Roadmap generated", icon: MapIcon },
  "roadmap.changed": { label: "Roadmap adapted", icon: Zap },
  "assessment.completed": { label: "Assessment completed", icon: CheckCircle2 },
  "assessment.failed": { label: "Assessment attempted", icon: AlertTriangle },
  "project.completed": { label: "Project completed", icon: Trophy },
  "interview.completed": { label: "Interview completed", icon: Mic },
  "career_goal.changed": { label: "Career goal changed", icon: Target },
  "weekly_hours.changed": { label: "Weekly hours updated", icon: Clock },
  "github.synced": { label: "GitHub synced", icon: Link2 },
};

function describeEvent(event: CareerEventRow): string | null {
  const payload = (event.payload_json ?? {}) as Record<string, unknown>;
  switch (event.event_type) {
    case "assessment.completed":
    case "assessment.failed":
      return payload.skill ? `${payload.skill} · ${payload.score}%` : null;
    case "roadmap.changed":
      return typeof payload.reason === "string" ? payload.reason : null;
    case "career_goal.changed":
      return payload.new_role ? `Now targeting ${payload.new_role}` : null;
    case "weekly_hours.changed":
      return payload.new_hours ? `${payload.new_hours}h/week` : null;
    case "project.completed":
      return typeof payload.task_title === "string" ? payload.task_title : null;
    default:
      return null;
  }
}

export function ActivityTimeline({ events }: { events: CareerEventRow[] }) {
  if (!events.length) {
    return <p className="text-sm text-slate-400">No activity yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const meta = EVENT_META[event.event_type] ?? { label: event.event_type, icon: Circle };
        const Icon = meta.icon;
        const detail = describeEvent(event);
        return (
          <li key={event.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-cyan-200">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-100">{meta.label}</p>
              {detail && <p className="text-xs text-slate-400">{detail}</p>}
              <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
