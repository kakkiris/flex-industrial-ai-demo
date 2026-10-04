"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClosingRentRollPanel } from "@/components/a5/ClosingRentRollPanel";
import { BulkUploadSummary } from "@/components/a5/BulkUploadSummary";
import { SixTableEmitPreview } from "@/components/a5/SixTableEmitPreview";
import { ClosingCreditsPanel } from "@/components/a5/ClosingCreditsPanel";
import { WorkflowChangePanel } from "@/components/shared/WorkflowChangePanel";
import type { YardiEtlTables } from "@/lib/etl/yardi-tables";
import type { ClosingCredits } from "@/lib/etl/acquisition-preview";

type BulkLoadResult = {
  propertyCode: string;
  leaseCount: number;
  occupiedUnits: number;
  vacantShells: number;
  totalSf: number;
  tables: YardiEtlTables;
  closingCredits: ClosingCredits;
};

export default function Page() {
  const mutation = useMutation<BulkLoadResult>({
    mutationFn: async () => {
      const res = await fetch("/api/acquisition/bulk-load", { method: "POST" });
      const json = (await res.json()) as {
        data: BulkLoadResult | null;
        error: string | null;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? "bulk-load failed");
      return json.data!;
    },
    onSuccess: (data) => {
      toast.success(
        `Loaded ${data.propertyCode}: ${data.leaseCount} leases, ${data.occupiedUnits} occupied units, ${data.vacantShells} vacant shells (${data.totalSf.toLocaleString()} SF) emitted across six Yardi tables.`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Bulk-load failed");
    },
  });

  const result = mutation.data ?? null;

  return (
    <div className="p-6 flex flex-col gap-4">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint mb-1.5">
          Acquisitions
        </p>
        <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">
          Acquisition Lease Bulk-Load
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed max-w-2xl">
          A deal closes and Keystone inherits the seller&apos;s in-place leases.
          One bulk load fans the closing rent roll out into the six linked Yardi
          commercial ETL tables, so the Accounting team skips lease-by-lease
          hand entry.
        </p>
      </header>

      <div className="rounded-sm border border-[var(--tone-violet-dot)]/40 bg-[var(--tone-violet-tint)] text-[var(--tone-violet-text)] px-3 py-2 text-xs leading-relaxed">
        A5 was added in the 2026-05-31 restructure. It absorbs the retired standalone L3: the single-lease Yardi path became L2, and the bulk acquisition path became A5.
      </div>

      <WorkflowChangePanel
        withDemoLabel="With A5"
        today="At every acquisition the Accounting team re-keys each inherited lease into the Yardi UI by hand, lease by lease: lease record, unit cross-reference, unit, square footage, charge schedule, and billing contact, one screen at a time. It is slow and error-prone, and vacant units are easy to miss so they never get set up as available to rent."
        withDemo="The closing rent roll loads once and fans out into all six commercial ETL tables in a single pass. Occupied units fan out across CommLeases, CommUnitXrefs, CommUnits, CommSQFTs, CommChargeSchedules, and CommContacts. Vacant units land as CommUnits plus CommSQFTs shells, ready to rent, so nothing falls through. The Accounting team reviews the emitted tables instead of typing them."
      />

      <ClosingRentRollPanel
        onEmit={() => mutation.mutate()}
        isLoading={mutation.isPending}
      />

      {result ? (
        <>
          <BulkUploadSummary
            counts={{
              propertyCode: result.propertyCode,
              leaseCount: result.leaseCount,
              occupiedUnits: result.occupiedUnits,
              vacantShells: result.vacantShells,
              totalSf: result.totalSf,
            }}
          />
          <ClosingCreditsPanel credits={result.closingCredits} />
          <SixTableEmitPreview tables={result.tables} />
        </>
      ) : null}
    </div>
  );
}
