"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { FilterSidebar, type SearchFilters } from "@/components/a1/FilterSidebar";
import { CompsTable, type CompRow } from "@/components/a1/CompsTable";
import { CompDetailPanel } from "@/components/a1/CompDetailPanel";
import { PDFUploader } from "@/components/shared/PDFUploader";
import { WorkflowChangePanel } from "@/components/shared/WorkflowChangePanel";
import { toast } from "sonner";

type Aggregates = {
  count: number;
  medianRentPerSqft: number | null;
  minRent: number | null;
  maxRent: number | null;
  // Bathroom premium delta (A1-2): median $/sqft spread for units with vs without
  // private bathrooms within the current filter scope.
  bathroomPremium: number | null;
  bathroomMedianWith: number | null;
  bathroomMedianWithout: number | null;
};

type SearchResult = {
  rows: CompRow[];
  aggregates: Aggregates;
};

export default function Page() {
  const [filters, setFilters] = useState<SearchFilters>({
    submarkets: [],
    minSqft: 1500,
    maxSqft: 2500,
    assetType: null,
    leaseType: null,
    hasBathroom: null,
    hasOffice: null,
    tenantCategories: [],
    clearHeightMin: 10,
    clearHeightMax: 36,
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ["search-comps", filters],
    queryFn: async () => {
      const res = await fetch("/api/search-comps", {
        method: "POST",
        body: JSON.stringify(filters),
        headers: { "content-type": "application/json" },
      });
      const json = (await res.json()) as { data: SearchResult | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? "search failed");
      return json.data!;
    },
  });

  const selectedRow = data?.rows.find((r) => r.unitId === selectedUnitId) ?? null;

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">
            Market Intelligence Dashboard
          </h1>
          <p className="text-sm text-foreground-muted leading-relaxed max-w-2xl">
            Filter KFP portfolio data and ingested OM rent rolls. Confidence badges cite each comp&apos;s source.
          </p>
          {data ? (
            <div className="mt-2 space-y-1">
              <p className="font-mono text-[11px] text-foreground-muted">
                <span className="tabular-nums">{data.aggregates.count}</span> comps
                <span className="text-foreground-faint mx-1.5">·</span>
                median <span className="tabular-nums">${data.aggregates.medianRentPerSqft?.toFixed(2) ?? "n/a"}</span>/sqft
                <span className="text-foreground-faint mx-1.5">·</span>
                <span className="tabular-nums">${data.aggregates.minRent?.toFixed(2) ?? "n/a"}</span> to <span className="tabular-nums">${data.aggregates.maxRent?.toFixed(2) ?? "n/a"}</span>
              </p>
              {data.aggregates.bathroomPremium !== null ? (
                <p className="font-mono text-[11px]">
                  <span className="text-foreground-muted">Bathroom premium: </span>
                  <span className={`tabular-nums font-medium ${data.aggregates.bathroomPremium >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {data.aggregates.bathroomPremium >= 0 ? "+" : ""}${data.aggregates.bathroomPremium.toFixed(2)}/sqft
                  </span>
                  <span className="text-foreground-faint mx-1.5">·</span>
                  <span className="text-foreground-muted">
                    with ${data.aggregates.bathroomMedianWith?.toFixed(2) ?? "n/a"} vs without ${data.aggregates.bathroomMedianWithout?.toFixed(2) ?? "n/a"} median
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="w-72 shrink-0">
          <PDFUploader
            uploadUrl="/api/ingest-om"
            label="Ingest a new OM PDF"
            onSuccess={(payload) => {
              const d = payload as {
                propertyName?: string | null;
                unitCount?: number | null;
                submarket?: string | null;
              } | null;
              const name = d?.propertyName ?? "OM";
              const units = d?.unitCount ?? 0;
              toast.success(
                units > 0
                  ? `Ingested ${name}: ${units} unit${units === 1 ? "" : "s"} added.`
                  : `Ingested ${name}.`,
              );
              void queryClient.invalidateQueries({ queryKey: ["search-comps"] });
              void queryClient.invalidateQueries({ queryKey: ["submarkets"] });
              void queryClient.invalidateQueries({ queryKey: ["tenant-categories"] });
            }}
          />
        </div>
      </header>

      <WorkflowChangePanel
        withDemoLabel="With A1"
        today="Underwriting comps are hand-built per deal: the analyst pulls CoStar exports, copy-pastes hundreds of rent roll rows from Yardi, scrolls OM PDFs page-by-page, and keys numbers into a one-off spreadsheet. Bathroom and clear-height splits live in nobody's filter. The deal team eyeballs 'plausible' rather than measures it."
        withDemo="A single dashboard fuses KFP's own rent roll, ingested OMs, and external feeds with full filter coverage (bathroom, office, tenant category, clear height). Every comp carries a confidence band and a UW comparison so the analyst sees deviation, leased impact, and vacancy drag side-by-side. OM uploads land in under a minute with new submarkets appearing as filter options automatically."
      />

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-3 p-3 overflow-auto">
          <FilterSidebar value={filters} onChange={setFilters} />
        </Card>
        <Card className="col-span-6 p-2 overflow-auto">
          <CompsTable
            rows={data?.rows ?? []}
            isLoading={isLoading}
            selectedUnitId={selectedUnitId}
            onSelect={setSelectedUnitId}
          />
        </Card>
        <Card className="col-span-3 p-4 overflow-auto">
          {selectedRow ? (
            <CompDetailPanel row={selectedRow} />
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a comp to see source citation and full detail.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
