"use client";

// A5 closing rent roll selector. The Acquisitions team picks the closing rent
// roll for a freshly closed deal and emits the six linked Yardi commercial ETL
// tables in one bulk load. The worked example is the Foundry deal. The live
// .xls upload path is shown as a clearly-disabled affordance ("needs Yardi
// access") since that round is out of scope.

import { Loader2, FileSpreadsheet, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

// Static description of the Foundry worked example. The post-load counts
// (occupied units, vacant shells, fan-out SF) come from the bulk-load response,
// not from this card; the card shows the deal as the Acquisitions team knows it
// at closing.
const FOUNDRY = {
  name: "Foundry Business Center",
  address: "1500 Foundry Avenue, Olmstead, TX 78475",
  county: "Merrick County",
  buildingSf: "~76,000 SF",
  occupied: 22,
  vacant: 4,
  closing: "Recently closed",
};

export function ClosingRentRollPanel({
  onEmit,
  isLoading,
}: {
  onEmit: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
      {/* Worked-example deal card */}
      <div className="rounded-md border border-border bg-card">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint mb-1.5">
              Closing rent roll
            </p>
            <h3 className="text-[15px] font-semibold tracking-[-0.005em] text-foreground">
              {FOUNDRY.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-foreground-muted">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              {FOUNDRY.address}
            </p>
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-faint whitespace-nowrap">
            {FOUNDRY.closing}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-t border-border [&>*]:border-border">
          <div className="px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
              County
            </p>
            <p className="mt-1 text-[13px] text-foreground">{FOUNDRY.county}</p>
          </div>
          <div className="px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
              Building
            </p>
            <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">
              {FOUNDRY.buildingSf}
            </p>
          </div>
          <div className="px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
              Occupied
            </p>
            <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">
              {FOUNDRY.occupied} leases
            </p>
          </div>
          <div className="px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
              Vacant
            </p>
            <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">
              {FOUNDRY.vacant} shells
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-background-subtle px-5 py-3.5">
          <Button onClick={onEmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Emitting tables
              </>
            ) : (
              "Emit Yardi ETL tables"
            )}
          </Button>
          <p className="text-[12px] text-foreground-muted">
            Fans out occupied leases across all six commercial tables and lands
            vacant units as available-to-rent shells.
          </p>
        </div>
      </div>

      {/* Disabled live-upload affordance */}
      <div className="lg:w-72 rounded-md border border-dashed border-border bg-background-subtle px-5 py-5 flex flex-col items-center text-center gap-2.5 opacity-90">
        <FileSpreadsheet
          className="size-6 text-foreground-faint"
          aria-hidden="true"
        />
        <p className="text-[13px] font-medium text-foreground-muted">
          Upload closing rent roll (.xls)
        </p>
        <Button variant="outline" size="sm" disabled>
          <Lock className="size-3.5" />
          Choose file
        </Button>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--tone-amber-text)]">
          Needs Yardi access
        </p>
        <p className="text-[11.5px] leading-relaxed text-foreground-faint">
          Live ingestion of the seller&apos;s raw export is out of scope this
          round. Use the worked example to preview the emit.
        </p>
      </div>
    </div>
  );
}
