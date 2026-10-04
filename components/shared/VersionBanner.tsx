import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DemoVersion } from "@/lib/version";

// One-line framing strip so the "both sides" story reads in a walkthrough.
// proposalText / reframedText let a page supply demo-specific copy; when
// omitted the generic defaults below render unchanged.
export function VersionBanner({
  version,
  proposalText,
  reframedText,
}: {
  version: DemoVersion;
  proposalText?: ReactNode;
  reframedText?: ReactNode;
}) {
  const proposal = version === "proposal";
  return (
    <div
      className={cn(
        "rounded-sm border px-3 py-2 text-xs leading-relaxed",
        proposal
          ? "border-[var(--tone-violet-dot)]/40 bg-[var(--tone-violet-tint)] text-[var(--tone-violet-text)]"
          : "border-border bg-background-subtle text-foreground-muted",
      )}
    >
      {proposal ? (
        proposalText ?? (
          <>
            <strong>FlexOps AI&apos;s original proposal.</strong> The client declined this path on the 29-May
            feedback; flip to &ldquo;Reframed&rdquo; to see the version we shipped.
          </>
        )
      ) : (
        reframedText ?? (
          <>
            <strong>Reframed</strong> after Jordan &amp; Alex&apos;s 29-May feedback (the version currently
            deployed). Flip to &ldquo;Our proposal&rdquo; to see what we originally pitched.
          </>
        )
      )}
    </div>
  );
}
