export interface CareerEventRow {
  id: string;
  event_type: string;
  payload_json: Record<string, unknown> | null;
  created_at: string;
}

export interface SmartNotification {
  id: string;
  tone: "positive" | "warning" | "info";
  message: string;
}

/**
 * Turns recent career_events into short notification strings. Deterministic
 * on purpose — these are simple enough not to need an AI call, and keeping
 * them rule-based means they're always consistent with what actually
 * happened (no risk of a notification describing something that didn't).
 */
export function buildSmartNotifications(
  events: CareerEventRow[],
  topSkillGap?: { skill: string; priority: number },
): SmartNotification[] {
  const notifications: SmartNotification[] = [];

  for (const event of events.slice(0, 6)) {
    const payload = (event.payload_json ?? {}) as Record<string, unknown>;
    switch (event.event_type) {
      case "assessment.failed":
        notifications.push({
          id: event.id,
          tone: "warning",
          message: `You fell behind on ${payload.skill ?? "a skill"} — we added a remediation step to your roadmap.`,
        });
        break;
      case "assessment.completed":
        notifications.push({
          id: event.id,
          tone: "positive",
          message: `Nice work — you passed your ${payload.skill ?? "skill"} assessment with ${payload.score ?? "a strong"}%.`,
        });
        break;
      case "weekly_hours.changed": {
        const prev = Number(payload.previous_hours ?? 0);
        const next = Number(payload.new_hours ?? 0);
        notifications.push({
          id: event.id,
          tone: next > prev ? "positive" : "info",
          message:
            next > prev
              ? `We shortened your roadmap because you increased your study time to ${next}h/week.`
              : `We extended your roadmap timeline after your study time dropped to ${next}h/week.`,
        });
        break;
      }
      case "project.completed":
        notifications.push({
          id: event.id,
          tone: "positive",
          message: `You unlocked progress by completing "${payload.task_title ?? "a project"}".`,
        });
        break;
      case "career_goal.changed":
        notifications.push({
          id: event.id,
          tone: "info",
          message: `Your roadmap was rebuilt for your new goal: ${payload.new_role ?? "your new role"}.`,
        });
        break;
      default:
        break;
    }
  }

  if (topSkillGap && topSkillGap.priority > 0) {
    notifications.push({
      id: "top-priority-skill",
      tone: "info",
      message: `${topSkillGap.skill} has become your highest priority skill gap.`,
    });
  }

  return notifications.slice(0, 4);
}
