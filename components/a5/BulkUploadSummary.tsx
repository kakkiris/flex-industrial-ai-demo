// A5 Acquisition Bulk-Load summary. The "single bulk upload" counts card the
// Acquisitions team sees the moment a closing rent roll fans out into the six
// Yardi commercial ETL tables. Numbers come straight from the bulk-load
// response (commLeases.length, distinct xref units, unreferenced unit shells,
// summed CommSQFTs).

import { FileStack, Building2, DoorOpen, Ruler } from "lucide-react";

export type BulkUploadCounts = {
  propertyCode: string;
  leaseCount: number;
  occupiedUnits: number;
  vacantShells: number;
  totalSf: number;
};

function StatCell({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof FileStack;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-foreground-muted">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <span className="font-mono text-2xl font-medium tabular-nums tracking-[-0.01em] text-foreground">
        {value}
      </span>
    </div>
  );
}

export function BulkUploadSummary({ counts }: { counts: BulkUploadCounts }) {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">
          Single bulk load
        </p>
        <span className="font-mono text-[11px] text-foreground-faint tabular-nums">
          {counts.propertyCode}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y divide-x divide-border border-t border-border [&>*]:border-border">
        <StatCell
          icon={FileStack}
          value={counts.leaseCount.toLocaleString()}
          label="Leases"
        />
        <StatCell
          icon={Building2}
          value={counts.occupiedUnits.toLocaleString()}
          label="Occupied units"
        />
        <StatCell
          icon={DoorOpen}
          value={counts.vacantShells.toLocaleString()}
          label="Vacant shells"
        />
        <StatCell
          icon={Ruler}
          value={`${counts.totalSf.toLocaleString()} sf`}
          label="Total SF"
        />
      </div>
    </div>
  );
}
