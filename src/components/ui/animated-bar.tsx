interface AnimatedBarProps {
  value: number; // 0-100
  colorClassName?: string;
  trackClassName?: string;
  heightClassName?: string;
  label?: string;
}

export function AnimatedBar({
  value,
  colorClassName = "bg-cyan-300",
  trackClassName = "bg-slate-800",
  heightClassName = "h-2",
  label,
}: AnimatedBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`overflow-hidden rounded-full ${heightClassName} ${trackClassName}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`transition-bar h-full rounded-full ${colorClassName}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
