// Synthetic underwriting values for OM-ingested units. Real KFP underwriting
// happens in Excel before acquisition; the demo approximates the comparison
// surface by running the same in-place-vs-market methodology the engine uses,
// against the submarket's market rent from getUwAssumptions. Without this,
// OM-ingested deals show a blank UW comparison panel because the OM extraction
// itself never carries UW figures.

import type { UwAssumptions } from "@/lib/uw-assumptions";
import { getUwAssumptions } from "@/lib/uw-assumptions";

export type OmUwInputs = {
  rentPerSqft: number | null;
  sizeSqft: number | null;
  // Retained for call-site structural compatibility; not used by the engine (impact is computed from inPlaceRentPsf * sizeSqft).
  annualRent: number | null;
  leaseStart: Date | null;
  // Optional market-rent context. When the caller knows the submarket and the
  // built-out signal we underwrite the in-place rent against the submarket
  // market rent. When it does not (e.g. a runtime OM upload with no built-out
  // signal), we treat the extracted rent as already at market so performance
  // to UW reads ~0 rather than fabricating upside.
  submarket?: string | null;
  isBuiltOut?: boolean;
  isExpansion?: boolean;
  asOf?: string;
};

export type OmUwOutputs = {
  rentUw: number | null;
  trendedRentAtLease: number | null;
  performanceToUw: number | null;
  leasedImpactUw: number | null;
  vacancyImpactUw: number | null;
  combinedImpactUw: number | null;
};

// Fixed reference date for deterministic seed underwriting. Trend math measures
// years from lease start to this date; using a fixed date keeps seed outputs
// identical across runs instead of drifting with the wall clock.
export const SEED_AS_OF = "2026-05-31";

export type UnitUwInput = {
  inPlaceRentPsf: number | null;
  marketRentPsf: number;
  sizeSqft: number;
  leaseStart: string | null;
  rentGrowthPct: number;
  asOf: string;
};
export type UnitUw = {
  rentUw: number;
  performanceToUw: number | null;
  trendedRentAtLease: number;
  leasedImpactUw: number | null;
  vacancyImpactUw: number;
  combinedImpactUw: number;
};

export function underwriteUnit(i: UnitUwInput): UnitUw {
  const market = Number(i.marketRentPsf.toFixed(2));
  const yearsSinceStart = i.leaseStart
    ? Math.max(0, (new Date(i.asOf).getTime() - new Date(i.leaseStart).getTime()) / (365.25 * 864e5))
    : 0;
  const trended = Number((market * Math.pow(1 + i.rentGrowthPct, yearsSinceStart)).toFixed(2));
  if (i.inPlaceRentPsf == null) {
    const vacancyImpact = Number((-market * i.sizeSqft).toFixed(2));
    return { rentUw: market, performanceToUw: null, trendedRentAtLease: trended,
      leasedImpactUw: null, vacancyImpactUw: vacancyImpact, combinedImpactUw: vacancyImpact };
  }
  const perf = Number(((i.inPlaceRentPsf - market) / market).toFixed(4));
  const leasedImpact = Number(((i.inPlaceRentPsf - market) * i.sizeSqft).toFixed(2));
  return { rentUw: market, performanceToUw: perf, trendedRentAtLease: trended,
    leasedImpactUw: leasedImpact, vacancyImpactUw: 0, combinedImpactUw: leasedImpact };
}

export type PropertyUwUnit = { inPlaceRentPsf: number | null; sizeSqft: number };
export type PropertyUw = {
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
};

export function underwriteProperty(units: PropertyUwUnit[], a: UwAssumptions, totalSqft: number): PropertyUw {
  const leased = units.filter((u) => u.inPlaceRentPsf != null);
  const leasedSqft = leased.reduce((s, u) => s + u.sizeSqft, 0);
  const inPlaceContractRent = leased.reduce((s, u) => s + (u.inPlaceRentPsf as number) * u.sizeSqft, 0);
  const weightedInPlacePsf = leasedSqft > 0 ? Number((inPlaceContractRent / leasedSqft).toFixed(2)) : null;
  const inPlaceNOI = Number((inPlaceContractRent * a.noiMargin).toFixed(0));
  const acquisitionPrice = Number((a.acquisitionBasisPsf * totalSqft).toFixed(0));
  const goingInCapPct = acquisitionPrice > 0 && leasedSqft > 0 ? Number((inPlaceNOI / acquisitionPrice).toFixed(4)) : null;
  const markToMarketUpsidePct = weightedInPlacePsf
    ? Number(((a.marketRentPsf - weightedInPlacePsf) / weightedInPlacePsf).toFixed(4)) : null;
  const stabilizedNOI = Number(
    (a.marketRentPsf * totalSqft * (1 - a.vacancyPct) * a.noiMargin * (1 + a.rentGrowthPct)).toFixed(0));
  const totalAllInCost = Number(
    (acquisitionPrice * (1 + a.acqCostPct) + a.capexToDemisePsf * totalSqft + a.reservesPsf * totalSqft).toFixed(0));
  const yieldOnCostPct = totalAllInCost > 0 ? Number((stabilizedNOI / totalAllInCost).toFixed(4)) : 0;
  return {
    inPlaceContractRent: Number(inPlaceContractRent.toFixed(0)),
    weightedInPlacePsf,
    inPlaceNOI,
    acquisitionPrice,
    goingInCapPct,
    marketRentLow: a.marketRentLow,
    marketRentHigh: a.marketRentHigh,
    markToMarketUpsidePct,
    stabilizedNOI,
    totalAllInCost,
    yieldOnCostPct,
    basisPsf: a.acquisitionBasisPsf,
  };
}

export type SensitivityCell = { yieldOnCostPct: number; tone: "good" | "mid" | "low" };
export type SensitivityMatrix = {
  rows: { purchasePrice: number; label: string }[];
  cols: { stabilizedRentPsf: number; label: string }[];
  cells: SensitivityCell[][];
  costToStabilize: number;
  targetYoCPct: number;
};

// Alex's 4-Jun primary A1 output: yield-on-cost across purchase price (rows) and
// stabilized rent/sqft (cols). Reuses the underwriteProperty stabilized-NOI and
// all-in-cost math so the base cell matches the headline figure. First pass:
// pending Alex's written spec, a 2nd underwriting model, and ground-up dev models.
export function sensitivityMatrix(input: {
  basePurchasePrice: number;
  baseStabilizedRentPsf: number;
  totalSqft: number;
  a: UwAssumptions;
  priceSteps?: number[];
  rentSteps?: number[];
  targetYoCPct?: number;
}): SensitivityMatrix {
  const { basePurchasePrice, baseStabilizedRentPsf, totalSqft, a } = input;
  const priceSteps = input.priceSteps ?? [-0.07, 0, 0.07];
  const rentSteps = input.rentSteps ?? [-0.12, 0, 0.12];
  const targetYoCPct = input.targetYoCPct ?? 0.08;

  const rows = priceSteps.map((p) => {
    const purchasePrice = Math.round(basePurchasePrice * (1 + p));
    return { purchasePrice, label: p === 0 ? "asking" : `${p > 0 ? "+" : ""}${Math.round(p * 100)}%` };
  });
  const cols = rentSteps.map((r) => {
    const stabilizedRentPsf = Number((baseStabilizedRentPsf * (1 + r)).toFixed(2));
    return { stabilizedRentPsf, label: `$${stabilizedRentPsf.toFixed(2)}` };
  });

  const capex = a.capexToDemisePsf * totalSqft;
  const reserves = a.reservesPsf * totalSqft;
  const cells = rows.map((row) =>
    cols.map((col) => {
      const stabilizedNOI = col.stabilizedRentPsf * totalSqft * (1 - a.vacancyPct) * a.noiMargin * (1 + a.rentGrowthPct);
      const allInCost = row.purchasePrice * (1 + a.acqCostPct) + capex + reserves;
      const yoc = allInCost > 0 ? Number((stabilizedNOI / allInCost).toFixed(4)) : 0;
      const tone: SensitivityCell["tone"] = yoc >= targetYoCPct ? "good" : yoc >= targetYoCPct - 0.01 ? "mid" : "low";
      return { yieldOnCostPct: yoc, tone };
    }),
  );

  return { rows, cols, cells, costToStabilize: Math.round(capex), targetYoCPct };
}

// Anticipated annual NOI lift if every expiring lease rolls to market. Positive
// only (below-market leases are the upside; above-market leases contribute 0).
// Used by C3's per-property expiration answer. Reuses the same market rent A1 uses.
export function noiLiftFromExpirations(
  leases: { inPlaceRentPsf: number | null; sizeSqft: number | null }[],
  marketRentPsf: number,
): number {
  return Math.round(
    leases.reduce((s, l) => {
      if (l.inPlaceRentPsf == null || l.sizeSqft == null) return s;
      return s + Math.max(0, marketRentPsf - l.inPlaceRentPsf) * l.sizeSqft;
    }, 0),
  );
}

export function synthesizeOmUw(inputs: OmUwInputs): OmUwOutputs {
  const { rentPerSqft, sizeSqft, leaseStart, submarket, isBuiltOut, isExpansion } =
    inputs;
  if (rentPerSqft == null || sizeSqft == null) {
    return {
      rentUw: null,
      trendedRentAtLease: null,
      performanceToUw: null,
      leasedImpactUw: null,
      vacancyImpactUw: null,
      combinedImpactUw: null,
    };
  }
  // Derive the submarket market rent from the engine. When we have no submarket
  // or no built-out signal, fall back to the unit's own extracted rent as the
  // market rent so performance to UW reads ~0 (extracted rent assumed already
  // at market) rather than fabricating upside.
  const expansion = isExpansion ?? false;
  const marketRentPsf = submarket
    ? getUwAssumptions(submarket, {
        isBuiltOut: isBuiltOut ?? false,
        isExpansion: expansion,
        fallbackRentPsf: rentPerSqft,
      }).marketRentPsf
    : rentPerSqft;
  const uw = underwriteUnit({
    inPlaceRentPsf: rentPerSqft,
    marketRentPsf,
    sizeSqft,
    leaseStart: leaseStart ? leaseStart.toISOString() : null,
    rentGrowthPct: expansion ? 0.035 : 0.05,
    asOf: inputs.asOf ?? SEED_AS_OF,
  });
  return {
    rentUw: uw.rentUw,
    trendedRentAtLease: uw.trendedRentAtLease,
    performanceToUw: uw.performanceToUw,
    leasedImpactUw: uw.leasedImpactUw,
    vacancyImpactUw: uw.vacancyImpactUw,
    combinedImpactUw: uw.combinedImpactUw,
  };
}
