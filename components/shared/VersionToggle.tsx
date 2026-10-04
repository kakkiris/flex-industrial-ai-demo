"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DemoVersion } from "@/lib/version";

// One option link in the segmented control. Hoisted to module scope (not
// defined inside VersionToggle) so it is a stable component across renders.
function Opt({
  v,
  label,
  current,
  href,
}: {
  v: DemoVersion;
  label: string;
  current: DemoVersion;
  href: (v: DemoVersion) => string;
}) {
  return (
    <Link
      href={href(v)}
      scroll={false}
      aria-current={current === v ? "true" : undefined}
      className={cn(
        "px-3 py-1 rounded-sm font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors",
        current === v ? "bg-foreground text-background" : "text-foreground-muted hover:bg-foreground/[0.06]",
      )}
    >
      {label}
    </Link>
  );
}

// Segmented control that sets ?v= on the current route. "reframed" is the
// default, so selecting it removes the param (clean URL). Presentational: the
// page passes the parsed `current` version in.
export function VersionToggle({ current }: { current: DemoVersion }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (v: DemoVersion) => {
    const sp = new URLSearchParams(params.toString());
    if (v === "reframed") sp.delete("v");
    else sp.set("v", v);
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
      <Opt v="proposal" label="Our proposal" current={current} href={href} />
      <Opt v="reframed" label="Reframed (current)" current={current} href={href} />
    </div>
  );
}
