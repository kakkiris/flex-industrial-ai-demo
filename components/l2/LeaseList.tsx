"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, type Tone } from "@/components/shared/StatusPill";
import { cn } from "@/lib/utils";

type LeaseRow = {
  leaseId: string;
  abstractId: string;
  tenantName: string | null;
  suite: string | null;
  leaseEnd: string | null;
  pdfPath: string | null;
  source: "seed" | "upload" | "bulk_load" | null;
  status: "awaiting_review" | "approved" | "pushed_to_yardi" | null;
};

type Filter = "all" | "awaiting_review" | "pushed_to_yardi";

// Visual revamp 2026-05-27. Status routed via shared StatusPill. Source tag
// reads as a small mono UPPERCASE annotation.

function statusPill(status: LeaseRow["status"]): { tone: Tone; label: string } {
  if (status === "awaiting_review") return { tone: "amber", label: "Awaiting review" };
  if (status === "approved") return { tone: "sky", label: "Approved" };
  if (status === "pushed_to_yardi") return { tone: "emerald", label: "Pushed" };
  // Null / unknown must never read as "Pushed" (activated in Yardi). An
  // un-stamped lease is treated as still awaiting review.
  return { tone: "amber", label: "Awaiting review" };
}

function SourceTag({ source }: { source: LeaseRow["source"] }) {
  if (source === "upload") {
    return (
      <span className="inline-flex items-center rounded-sm px-1 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.06em] bg-foreground/[0.06] text-foreground-muted">
        Upload
      </span>
    );
  }
  return null;
}

export function LeaseList({ selectedLeaseId, onSelect }: { selectedLeaseId: string | null; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["leases"],
    queryFn: async () => {
      const res = await fetch("/api/lease/abstracts");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "fetch failed");
      return json.data as LeaseRow[];
    },
  });

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );
  if (error) return <p className="text-sm text-rose-700">Failed to load leases</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No leases yet. Upload a sample to get started.</p>;

  const awaitingCount = data.filter((r) => r.status === "awaiting_review").length;

  const filtered = data
    .filter((r) => filter === "all" || r.status === filter)
    // Awaiting review at the top so reviewers see action items first
    .slice()
    .sort((a, b) => {
      const rank = (s: LeaseRow["status"]) =>
        s === "awaiting_review" ? 0 : s === "approved" ? 1 : 2;
      return rank(a.status) - rank(b.status);
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 mb-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={data.length}>
          All
        </FilterChip>
        <FilterChip active={filter === "awaiting_review"} onClick={() => setFilter("awaiting_review")} count={awaitingCount}>
          Review
        </FilterChip>
        <FilterChip active={filter === "pushed_to_yardi"} onClick={() => setFilter("pushed_to_yardi")}>
          Pushed
        </FilterChip>
      </div>

      {filtered.map((row) => {
        const pill = statusPill(row.status);
        return (
          <button
            key={row.leaseId}
            type="button"
            onClick={() => onSelect(row.leaseId)}
            className={cn(
              "w-full text-left rounded-sm border border-border bg-background px-3 py-2.5 transition-colors hover:bg-foreground/[0.025]",
              selectedLeaseId === row.leaseId && "bg-foreground/[0.04] border-border-strong",
              row.status === "awaiting_review" && "border-[var(--tone-amber-dot)]/40 bg-[var(--tone-amber-tint)]/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-foreground truncate">{row.tenantName ?? "Unknown tenant"}</div>
              <SourceTag source={row.source} />
            </div>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="text-xs text-foreground-muted truncate">
                <span className="font-mono tabular-nums">Suite {row.suite ?? "?"}</span>
                {row.leaseEnd ? (
                  <>
                    {" "}
                    <span className="text-foreground-faint">→</span>{" "}
                    <span className="font-mono tabular-nums">{new Date(row.leaseEnd).toLocaleDateString()}</span>
                  </>
                ) : null}
              </div>
              <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-foreground-muted hover:bg-foreground/[0.04]"
      )}
    >
      {children}
      {count != null ? <span className="ml-1 tabular-nums opacity-70">{count}</span> : null}
    </button>
  );
}
