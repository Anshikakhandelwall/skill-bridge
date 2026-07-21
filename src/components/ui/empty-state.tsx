import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref, onCta, children }: EmptyStateProps) {
  return (
    <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">{description}</p>
      {children}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="mt-5 inline-block">
          <Button>{ctaLabel}</Button>
        </Link>
      )}
      {ctaLabel && onCta && !ctaHref && (
        <Button onClick={onCta} className="mt-5">
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
