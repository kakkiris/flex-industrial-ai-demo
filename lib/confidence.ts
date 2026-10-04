import { z } from "zod";

export const ConfidenceLevel = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const ConfidenceMap = z.record(
  z.string(),
  z.object({
    level: ConfidenceLevel,
    reason: z.string().optional(),
  })
);
export type ConfidenceMap = z.infer<typeof ConfidenceMap>;

export const SOURCE_RANK: Record<string, ConfidenceLevel> = {
  signed_lease: "high",
  om_rent_roll: "medium",
  costar_estimate: "low",
};

// Visual revamp 2026-05-27. Confidence badges route through semantic tone
// tokens (emerald/amber/rose) defined in globals.css so a palette change is
// one file. The shape (square, mono UPPER) is set on ConfidenceBadge itself.
export function badgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "bg-[var(--tone-emerald-tint)] text-[var(--tone-emerald-text)] border-[var(--tone-emerald-dot)]/30";
    case "medium":
      return "bg-[var(--tone-amber-tint)] text-[var(--tone-amber-text)] border-[var(--tone-amber-dot)]/30";
    case "low":
      return "bg-[var(--tone-rose-tint)] text-[var(--tone-rose-text)] border-[var(--tone-rose-dot)]/30";
  }
}

export function lowestField(map: ConfidenceMap): ConfidenceLevel {
  const order: ConfidenceLevel[] = ["low", "medium", "high"];
  for (const lvl of order) {
    for (const key of Object.keys(map)) {
      if (map[key].level === lvl) return lvl;
    }
  }
  return "high";
}
