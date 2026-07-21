"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

const CONFETTI_COLORS = ["#67e8f9", "#34d399", "#fbbf24", "#fb7185", "#a78bfa"];

interface CelebrationProps {
  active: boolean;
  message: string;
  onDismiss?: () => void;
}

/** Tasteful, dependency-free celebration: a brief confetti burst plus a success banner. Auto-dismisses. */
export function Celebration({ active, message, onDismiss }: CelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4200);
    return () => clearTimeout(timer);
  }, [active, onDismiss]);

  if (!visible) return null;

  const particles = Array.from({ length: 24 });

  return (
    <div
      role="status"
      className="animate-scale-in relative overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {particles.map((_, index) => (
          <span
            key={index}
            className="animate-confetti absolute top-0 block h-2 w-1 rounded-sm"
            style={{
              left: `${(index / particles.length) * 100}%`,
              backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
              animationDuration: `${900 + (index % 5) * 150}ms`,
              animationDelay: `${(index % 6) * 60}ms`,
            }}
          />
        ))}
      </div>
      <div className="relative flex items-center gap-2 text-sm font-medium text-emerald-100">
        <Trophy className="size-4 shrink-0" aria-hidden="true" />
        {message}
      </div>
    </div>
  );
}
