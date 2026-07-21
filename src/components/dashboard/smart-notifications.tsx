import type { SmartNotification } from "@/lib/career/notifications";

const TONE_CLASSES: Record<SmartNotification["tone"], string> = {
  positive: "border-emerald-400/30 bg-emerald-400/5 text-emerald-100",
  warning: "border-amber-400/30 bg-amber-400/5 text-amber-100",
  info: "border-cyan-300/30 bg-cyan-300/5 text-cyan-100",
};

export function SmartNotifications({ notifications }: { notifications: SmartNotification[] }) {
  if (!notifications.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {notifications.map((notification) => (
        <div key={notification.id} className={`rounded-lg border p-3 text-sm ${TONE_CLASSES[notification.tone]}`}>
          {notification.message}
        </div>
      ))}
    </div>
  );
}
