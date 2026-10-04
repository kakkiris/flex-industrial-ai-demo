"use client";
import { useQuery } from "@tanstack/react-query";
import { CitationCard, type CitationData } from "@/components/shared/CitationCard";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { type ConfidenceLevel } from "@/lib/confidence";
import { type SensitivityMatrix } from "@/lib/uw";
import { Skeleton } from "@/components/ui/skeleton";

type ConfidenceObj = {
  level: ConfidenceLevel;
  sourceType: string;
  rawQuote: string | null;
  page: number | null;
};

export type CompRow = {
  unitId: string;
  propertyId: string;
  propertyName: string;
  submarket: string;
  state: string;
  suite: string | null;
  sizeSqft: number | null;
  rentPerSqft: number | null;
  leaseType: string | null;
  tenantName: string | null;
  confidence: ConfidenceObj;
};

type UnitDetail = {
  id: string;
  suite: string | null;
  sizeSqft: number | null;
  leaseType: string | null;
  hasPrivateBathroom: boolean | null;
  currentRent: number | null;
  rentPerSqft: number | null;
  leaseStart: Date | null;
  leaseEnd: Date | null;
  tenantName: string | null;
  tenantCategory: string | null;
  rentUw: number | null;
  trendedRentAtLease: number | null;
  performanceToUw: number | null;
  leasedImpactUw: number | null;
  vacancyImpactUw: number | null;
  combinedImpactUw: number | null;
  legacyRent: number | null;
  kfpRent: number | null;
  ccLevel: string | null;
  ccSource: string | null;
  ccQuote: string | null;
  ccPage: number | null;
};

type PropertyDetail = {
  id: string;
  name: string;
  address: string | null;
  submarket: string | null;
  state: string | null;
  totalSqft: number | null;
  assetType: string | null;
  yearBuilt: number | null;
  clearHeightFt: number | null;
  hasOffice: boolean | null;
  source: string | null;
  sourceDocId: string | null;
};

type SourceDoc = {
  id: string;
  filename: string | null;
  pdfPath: string | null;
} | null;

// Property-level underwriting snapshot from the T6 API. Decimals
// (goingInCapPct / markToMarketUpsidePct / yieldOnCostPct) are ratios, e.g.
// 0.0760 = 7.60%. weightedInPlacePsf and markToMarketUpsidePct are null for a
// fully-vacant property.
type Underwriting = {
  inPlaceContractRent: number;
  weightedInPlacePsf: number | null;
  inPlaceNOI: number;
  acquisitionPrice: number;
  goingInCapPct: number | null;
  marketRentLow: number;
  marketRentHigh: number;
  markToMarketUpsidePct: number | null;
  stabilizedNOI: number;
  totalAllInCost: number;
  yieldOnCostPct: number;
  basisPsf: number;
} | null;

type ApiResponse = {
  data: {
    property: PropertyDetail;
    units: UnitDetail[];
    sourceDoc: SourceDoc;
    underwriting: Underwriting;
    sensitivity: SensitivityMatrix | null;
  } | null;
  error: string | null;
};

type Props = {
  row: CompRow;
};

function fmt(date: Date | string | null | undefined): string {
  if (!date) return "n/a";
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? "n/a" : d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

// Decimal ratio (e.g. 0.0760) to a percent string ("7.6%"). Null renders a dash.
function pct(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

// Whole-dollar amount to a compact string: millions get one decimal and an "M"
// suffix ("$1.6M"), smaller amounts get grouped digits ("$634,796").
function compactUsd(value: number | null | undefined): string {
  if (value == null) return "-";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

async function fetchPropertyUnits(propertyId: string): Promise<ApiResponse["data"]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/units`);
  const json = (await res.json()) as ApiResponse;
  if (json.error || !json.data) throw new Error(json.error ?? "Failed to load detail");
  return json.data;
}

function UwComparison({ unit }: { unit: UnitDetail }) {
  const actual = unit.rentPerSqft;
  const uw = unit.rentUw;

  // Performance to UW: prefer the stored field; fall back to deriving it from
  // actual vs uw so the value is always present when rent data exists.
  // Stored as a decimal ratio (e.g. 0.0870 = +8.70%), signed.
  let perfToUw: number | null = null;
  if (unit.performanceToUw != null) {
    perfToUw = unit.performanceToUw;
  } else if (actual != null && uw != null && uw > 0) {
    perfToUw = (actual - uw) / uw;
  }

  // Deviation is the ratio of actual to UW (i.e. 100% = exactly on plan).
  // Kept for the existing flag/pill logic and the Deviation label row.
  let deviation: number | null = null;
  if (actual != null && uw != null && uw > 0) deviation = (actual / uw) * 100;
  else if (perfToUw != null) deviation = (1 + perfToUw) * 100;

  const flag =
    deviation == null
      ? null
      : deviation >= 105
        ? { label: "Outperforming UW", tone: "emerald" as const, arrow: "+" }
        : deviation >= 95
          ? { label: "On plan", tone: "sky" as const, arrow: "=" }
          : { label: "Underperforming", tone: "rose" as const, arrow: "-" };

  // Visual revamp 2026-05-27. UW comparison is the moment of the A1 demo;
  // the surface CRE managers care about most. Layout: section cap ->
  // Performance to UW headline (signed %, color coded above/below) ->
  // Deviation secondary + status pill -> side-by-side comp/uw figures ->
  // 3-cell impact mini-grid. Tabular-nums applied throughout so digits
  // align cleanly.
  const flagTone =
    flag?.tone === "emerald"
      ? "text-[var(--tone-emerald-text)] bg-[var(--tone-emerald-tint)] border-[var(--tone-emerald-dot)]/30"
      : flag?.tone === "sky"
        ? "text-[var(--tone-sky-text)] bg-[var(--tone-sky-tint)] border-[var(--tone-sky-dot)]/30"
        : "text-[var(--tone-rose-text)] bg-[var(--tone-rose-tint)] border-[var(--tone-rose-dot)]/30";

  // Performance to UW = (in-place rent - market rent) / market. The sign now
  // reads as acquisition signal, not plan performance: NEGATIVE (in-place below
  // market) is acquisition UPSIDE, so it renders GREEN; POSITIVE (in-place above
  // market) is rollover risk, so it renders amber. Zero (on market) stays
  // neutral. This inverts the old "above plan = green" coloring on purpose.
  const perfColor =
    perfToUw == null
      ? "text-foreground"
      : perfToUw < 0
        ? "text-[var(--tone-emerald-text)]"
        : perfToUw > 0
          ? "text-[var(--tone-amber-text)]"
          : "text-foreground";

  const perfLabel =
    perfToUw == null
      ? "n/a"
      : `${perfToUw >= 0 ? "+" : ""}${(perfToUw * 100).toFixed(2)}%`;

  // Plain-language qualifier so a viewer reads the sign correctly: negative is
  // below market (good for the buyer), positive is above market (rollover risk).
  const perfQualifier =
    perfToUw == null
      ? null
      : perfToUw < 0
        ? "below market"
        : perfToUw > 0
          ? "above market"
          : "at market";

  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-3">
        In-place vs market (underwritten)
      </p>

      {/* Performance to UW headline: the named, color-coded figure Alex tracks.
          Negative = below market = acquisition upside (green); positive = above
          market = rollover risk (amber). The qualifier spells out the sign. */}
      <div className="rounded-sm border border-border bg-background-subtle px-3 py-2.5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-1">
          Performance to UW
        </p>
        <div className="flex items-baseline gap-2">
          <p className={`font-mono tabular-nums text-2xl font-semibold leading-none ${perfColor}`}>
            {perfLabel}
          </p>
          {perfQualifier ? (
            <span className={`font-mono text-[10px] uppercase tracking-[0.05em] ${perfColor}`}>
              {perfQualifier}
            </span>
          ) : null}
        </div>
        {perfToUw != null ? (
          <p className="font-mono text-[10px] tracking-[0.02em] mt-1 text-foreground-faint normal-case">
            {perfToUw < 0
              ? "in-place below market: acquisition upside"
              : perfToUw > 0
                ? "in-place above market: rollover risk"
                : "in-place at market"}
          </p>
        ) : null}
      </div>

      {/* Deviation secondary + status pill */}
      <div className="flex items-end justify-between mb-4 pb-4 border-b border-border">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-0.5">
            Deviation
          </p>
          <p className="font-mono tabular-nums text-2xl font-medium leading-none text-foreground">
            {deviation != null ? `${deviation.toFixed(1)}%` : "n/a"}
          </p>
        </div>
        {flag ? (
          <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em] ${flagTone}`}>
            <span aria-hidden="true">{flag.arrow}</span>
            {flag.label}
          </span>
        ) : null}
      </div>

      {/* Comp vs UW side-by-side */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-1">
            Comp rent
          </p>
          <p className="font-mono tabular-nums text-sm text-foreground">
            {actual != null ? `$${actual.toFixed(2)}` : "n/a"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-1">
            Market (underwritten)
          </p>
          <p className="font-mono tabular-nums text-sm text-foreground">
            {uw != null ? `$${uw.toFixed(2)}` : "n/a"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-1">
            Trended at lease
          </p>
          <p className="font-mono tabular-nums text-sm text-foreground">
            {unit.trendedRentAtLease != null ? `$${unit.trendedRentAtLease.toFixed(2)}` : "n/a"}
          </p>
        </div>
      </div>

      {/* Impact mini-grid */}
      <div className="grid grid-cols-3 gap-3">
        <ImpactCell label="Leased impact" value={unit.leasedImpactUw} />
        <ImpactCell label="Vacancy impact" value={unit.vacancyImpactUw} />
        <ImpactCell label="Combined" value={unit.combinedImpactUw} />
      </div>
    </div>
  );
}

function ImpactCell({ label, value }: { label: string; value: number | null }) {
  // value is a dollar variance vs underwriting (positive = over-plan, negative
  // = under-plan or vacancy drag). Render as signed currency, not percent.
  const formatted =
    value == null
      ? "-"
      : `${value < 0 ? "-" : "+"}$${Math.abs(Math.round(value)).toLocaleString()}`;
  const tone =
    value == null
      ? "text-foreground"
      : value > 0
        ? "text-[var(--tone-emerald-text)]"
        : value < 0
          ? "text-[var(--tone-rose-text)]"
          : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-background-subtle px-2.5 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-0.5">
        {label}
      </p>
      <p className={`font-mono tabular-nums text-sm ${tone}`}>{formatted}</p>
    </div>
  );
}

function LegacyVsKfp({ unit }: { unit: UnitDetail }) {
  const which = unit.kfpRent != null && (unit.legacyRent == null || unit.kfpRent > 0)
    ? { label: "KFP-signed", tone: "emerald" as const }
    : { label: "Legacy (pre-acquisition)", tone: "amber" as const };
  const tint =
    which.tone === "emerald"
      ? "text-[var(--tone-emerald-text)] bg-[var(--tone-emerald-tint)] border-[var(--tone-emerald-dot)]/30"
      : "text-[var(--tone-amber-text)] bg-[var(--tone-amber-tint)] border-[var(--tone-amber-dot)]/30";
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
        Legacy vs KFP
      </p>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em] ${tint}`}>
          {which.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-0.5">
            Legacy rent / sqft
          </p>
          <p className="font-mono tabular-nums text-sm text-foreground">
            {unit.legacyRent != null ? `$${unit.legacyRent.toFixed(2)}` : "-"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-0.5">
            KFP rent / sqft
          </p>
          <p className="font-mono tabular-nums text-sm text-foreground">
            {unit.kfpRent != null ? `$${unit.kfpRent.toFixed(2)}` : "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

function UwStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald";
}) {
  const valueTone = tone === "emerald" ? "text-[var(--tone-emerald-text)]" : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-background-subtle px-2.5 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint mb-0.5">
        {label}
      </p>
      <p className={`font-mono tabular-nums text-sm ${valueTone}`}>{value}</p>
    </div>
  );
}

// Alex's 4-Jun primary A1 output: a yield-on-cost sensitivity table across
// purchase price (rows) x stabilized rent/sqft (cols). Cells are tone-colored
// using the same semantic tone vars the rest of the panel uses: good = emerald
// (>= target), mid = amber (within 1pt of target), low = rose (below). Renders
// as the headline at the top of the Property Underwriting section.
const TONE_CELL: Record<SensitivityMatrix["cells"][number][number]["tone"], string> = {
  good: "text-[var(--tone-emerald-text)] bg-[var(--tone-emerald-tint)] border-[var(--tone-emerald-dot)]/30",
  mid: "text-[var(--tone-amber-text)] bg-[var(--tone-amber-tint)] border-[var(--tone-amber-dot)]/30",
  low: "text-[var(--tone-rose-text)] bg-[var(--tone-rose-tint)] border-[var(--tone-rose-dot)]/30",
};

function SensitivityTable({ s }: { s: SensitivityMatrix }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-1">
        Yield-on-cost sensitivity
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">
        Purchase price (rows) x stabilized rent / sqft (cols)
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-faint">
                Price \ Rent
              </th>
              {s.cols.map((col) => (
                <th
                  key={col.label}
                  className="px-2 py-1 text-right font-mono tabular-nums text-[10.5px] font-medium text-foreground"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rows.map((row, ri) => (
              <tr key={row.purchasePrice}>
                <th className="px-2 py-1 text-left align-middle">
                  <span className="block font-mono tabular-nums text-[11px] font-medium text-foreground">
                    {compactUsd(row.purchasePrice)}
                  </span>
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.05em] text-foreground-faint">
                    {row.label}
                  </span>
                </th>
                {s.cells[ri].map((cell, ci) => (
                  <td key={s.cols[ci].label} className="px-1 py-1">
                    <span
                      className={`block rounded-sm border px-2 py-1.5 text-right font-mono tabular-nums text-sm ${TONE_CELL[cell.tone]}`}
                    >
                      {pct(cell.yieldOnCostPct)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-0.5">
        <p className="font-mono tabular-nums text-[11px] text-foreground">
          Cost to stabilize: ~{compactUsd(s.costToStabilize)}
        </p>
        <p className="font-mono text-[10px] tracking-[0.02em] text-foreground-faint normal-case">
          target yield-on-cost &gt;= {(s.targetYoCPct * 100).toFixed(0)}%
        </p>
      </div>

      <p className="mt-3 text-[10.5px] leading-snug text-muted-foreground italic">
        First pass: pending Alex&apos;s written spec, a second underwriting model, and ground-up
        development models.
      </p>
    </div>
  );
}

function PropertyUnderwriting({ uw }: { uw: NonNullable<Underwriting> }) {
  // Mark-to-market upside reads green only when it is positive (in-place below
  // market = room to push rents). Null or non-positive stays neutral.
  const upsideTone = uw.markToMarketUpsidePct != null && uw.markToMarketUpsidePct > 0 ? "emerald" : undefined;
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-1">
        Underwriting
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">
        How Keystone underwrites this property
      </p>
      <div className="grid grid-cols-2 gap-2">
        <UwStat label="Going-in cap rate" value={pct(uw.goingInCapPct)} />
        <UwStat
          label="Market rent range"
          value={`$${uw.marketRentLow.toFixed(2)} - $${uw.marketRentHigh.toFixed(2)} /sqft`}
        />
        <UwStat label="Mark-to-market upside" value={pct(uw.markToMarketUpsidePct)} tone={upsideTone} />
        <UwStat label="In-place NOI" value={compactUsd(uw.inPlaceNOI)} />
        <UwStat label="Stabilized NOI" value={compactUsd(uw.stabilizedNOI)} />
        <UwStat label="Yield-on-cost" value={pct(uw.yieldOnCostPct)} />
        <UwStat label="Basis" value={`$${uw.basisPsf.toFixed(2)} /sqft`} />
      </div>
    </div>
  );
}

export function CompDetailPanel({ row }: Props) {
  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["property-units", row.propertyId],
    queryFn: () => fetchPropertyUnits(row.propertyId),
    enabled: Boolean(row.propertyId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-rose-700">
        Error: {error instanceof Error ? error.message : "Failed to load detail"}
      </p>
    );
  }

  const property = detail?.property;
  const unit = detail?.units.find((u) => u.id === row.unitId);
  const sourceDoc = detail?.sourceDoc ?? null;
  const underwriting = detail?.underwriting ?? null;
  const sensitivity = detail?.sensitivity ?? null;

  // Build citation from the comp row's confidence data + the source doc.
  const citation: CitationData = {
    rawQuote: row.confidence.rawQuote,
    page: row.confidence.page,
    sourceFilename: sourceDoc?.filename ?? null,
    sourcePath: sourceDoc?.pdfPath ?? null,
    sourceType: row.confidence.sourceType,
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="font-semibold text-base leading-tight">{property?.name ?? row.propertyName}</h2>
        {property?.address ? (
          <p className="text-muted-foreground text-xs mt-0.5">{property.address}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Submarket</span>
        <span>{property?.submarket ?? row.submarket}</span>
        <span className="text-muted-foreground">State</span>
        <span>{property?.state ?? row.state}</span>
        <span className="text-muted-foreground">Asset type</span>
        <span>{property?.assetType ?? "n/a"}</span>
        <span className="text-muted-foreground">Total sqft</span>
        <span>{property?.totalSqft?.toLocaleString() ?? "n/a"}</span>
        <span className="text-muted-foreground">Year built</span>
        <span>{property?.yearBuilt ?? "n/a"}</span>
        <span className="text-muted-foreground">Office</span>
        <span>{property?.hasOffice == null ? "-" : property.hasOffice ? "Y" : "N"}</span>
        <span className="text-muted-foreground">Clear height</span>
        <span>
          {property?.clearHeightFt != null ? (
            `${property.clearHeightFt}'`
          ) : (
            <span className="text-[10px] text-muted-foreground italic">pending capture</span>
          )}
        </span>
      </div>

      {/* Property Underwriting section. The yield-on-cost sensitivity table is
          the headline A1 output (Alex, 4-Jun); the property-level snapshot
          (fed by data.underwriting) sits below it. */}
      {sensitivity || underwriting ? (
        <>
          <hr />
          {sensitivity ? <SensitivityTable s={sensitivity} /> : null}
          {sensitivity && underwriting ? <hr /> : null}
          {underwriting ? <PropertyUnderwriting uw={underwriting} /> : null}
        </>
      ) : null}

      <hr />

      <div>
        <p className="font-medium mb-2 flex items-center gap-2">
          Suite {unit?.suite ?? row.suite ?? "-"}
          <ConfidenceBadge level={row.confidence.level} />
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">Size</span>
          <span>{(unit?.sizeSqft ?? row.sizeSqft)?.toLocaleString() ?? "-"} sqft</span>
          <span className="text-muted-foreground">Rent / sqft</span>
          <span>
            {(unit?.rentPerSqft ?? row.rentPerSqft) != null
              ? `$${(unit?.rentPerSqft ?? row.rentPerSqft)!.toFixed(2)}`
              : "-"}
          </span>
          <span className="text-muted-foreground">Monthly rent</span>
          <span>
            {unit?.currentRent != null
              ? `$${unit.currentRent.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : "-"}
          </span>
          <span className="text-muted-foreground">Lease type</span>
          <span>{unit?.leaseType ?? row.leaseType ?? "-"}</span>
          <span className="text-muted-foreground">Tenant</span>
          <span>{unit?.tenantName ?? row.tenantName ?? "-"}</span>
          <span className="text-muted-foreground">Category</span>
          <span>
            {unit?.tenantCategory ? (
              unit.tenantCategory
            ) : (
              <span className="text-[10px] text-muted-foreground italic">pending capture</span>
            )}
          </span>
          <span className="text-muted-foreground">Bathroom</span>
          <span>
            {unit?.hasPrivateBathroom == null
              ? "-"
              : unit.hasPrivateBathroom
                ? "Y (private)"
                : "N"}
          </span>
          <span className="text-muted-foreground">Lease start</span>
          <span>{fmt(unit?.leaseStart)}</span>
          <span className="text-muted-foreground">Lease end</span>
          <span>{fmt(unit?.leaseEnd)}</span>
        </div>
      </div>

      {/* UW comparison */}
      {unit && (unit.rentUw != null || unit.performanceToUw != null) && (
        <>
          <hr />
          <UwComparison unit={unit} />
        </>
      )}

      {/* Legacy vs KFP indicator */}
      {unit && (unit.legacyRent != null || unit.kfpRent != null) && (
        <>
          <hr />
          <LegacyVsKfp unit={unit} />
        </>
      )}

      <hr />

      <div>
        <p className="font-medium mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Source Citation
        </p>
        <CitationCard citation={citation} />
      </div>
    </div>
  );
}
