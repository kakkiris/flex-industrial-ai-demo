import { cn } from "@/lib/utils";

// Shared StatusPill consolidates the inline pill implementations across
// L2 LeaseList, A3 ChecklistPanel / DealList / BlockerCenter, and L1 LeadInbox.
// Single source of truth for tone styling; tones come from the semantic tokens
// defined in globals.css so the whole app shifts palette in one file.

export type Tone = "emerald" | "amber" | "rose" | "sky" | "violet" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  emerald:
    "bg-[var(--tone-emerald-tint)] text-[var(--tone-emerald-text)] border-[var(--tone-emerald-dot)]/30",
  amber:
    "bg-[var(--tone-amber-tint)] text-[var(--tone-amber-text)] border-[var(--tone-amber-dot)]/30",
  rose:
    "bg-[var(--tone-rose-tint)] text-[var(--tone-rose-text)] border-[var(--tone-rose-dot)]/30",
  sky:
    "bg-[var(--tone-sky-tint)] text-[var(--tone-sky-text)] border-[var(--tone-sky-dot)]/30",
  violet:
    "bg-[var(--tone-violet-tint)] text-[var(--tone-violet-text)] border-[var(--tone-violet-dot)]/30",
  neutral:
    "bg-foreground/[0.04] text-foreground-muted border-foreground/15",
};

const DOT_CLASS: Record<Tone, string> = {
  emerald: "bg-[var(--tone-emerald-dot)]",
  amber: "bg-[var(--tone-amber-dot)]",
  rose: "bg-[var(--tone-rose-dot)]",
  sky: "bg-[var(--tone-sky-dot)]",
  violet: "bg-[var(--tone-violet-dot)]",
  neutral: "bg-foreground/40",
};

export function StatusPill({
  tone,
  children,
  withDot = false,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  withDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center gap-1 rounded-full border px-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] whitespace-nowrap",
        TONE_CLASS[tone],
        className
      )}
    >
      {withDot ? (
        <span className={cn("inline-block size-1.5 rounded-full", DOT_CLASS[tone])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
