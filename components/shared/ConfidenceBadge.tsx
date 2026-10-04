import { type ConfidenceLevel, badgeClass } from "@/lib/confidence";
import { cn } from "@/lib/utils";

// Visual revamp 2026-05-27. Confidence reads as a data-tag, not a status
// pill: square corners, Plex Mono small UPPERCASE, tone-tinted from the
// semantic tokens. Reuses badgeClass() from lib/confidence for the tones.
export function ConfidenceBadge({ level, className }: { level: ConfidenceLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded-sm border px-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em] whitespace-nowrap",
        badgeClass(level),
        className
      )}
    >
      {level}
    </span>
  );
}
