import { id } from "@/lib/ids";
import { TENANT_TYPES, SUBMARKETS, makeRng, pickRange, pickFrom } from "./_data";
import { getUwAssumptions } from "@/lib/uw-assumptions";
import { underwriteUnit, SEED_AS_OF } from "@/lib/uw";
import type { buildProperties } from "./properties";

type Property = ReturnType<typeof buildProperties>[number];


export function buildUnits(properties: Property[]) {
  const rng = makeRng(202);
  const submarketMap = new Map(SUBMARKETS.map((s) => [s.name, s]));

  const units = properties.flatMap((property) => {
    const sm = submarketMap.get(property.submarket!);
    if (!sm) return [];
    const unitCount = pickRange(rng, 10, 15);
    const propertyUnits: Array<ReturnType<typeof buildUnit>> = [];
    for (let i = 0; i < unitCount; i++) {
      propertyUnits.push(buildUnit(rng, property, sm, i));
    }
    // Set proportionate share once we know the total (sum of sized sqft) so
    // each unit's share rolls up to ~100% of leasable space.
    const totalLeasableSf = propertyUnits.reduce((s, u) => s + (u.sizeSqft ?? 0), 0);
    if (totalLeasableSf > 0) {
      for (const u of propertyUnits) {
        u.proportionateShareRsf = Number(((u.sizeSqft! / totalLeasableSf) * 100).toFixed(2));
      }
    }
    return propertyUnits;
  });

  return units;
}

function buildUnit(
  rng: () => number,
  property: Property,
  sm: typeof SUBMARKETS[number],
  i: number
) {
  // Bias toward 1500-2500 sqft (~75%), wider 1200-4500 outliers (~25%).
  const sizeSqft =
    rng() < 0.75 ? pickRange(rng, 1_500, 2_500) : pickRange(rng, 1_200, 4_500);
  const leased = rng() > 0.3;
  const hasBath = rng() < 0.2;
  // Office at unit level: roughly 30% chance, biased higher when property has office.
  const hasOfficeAtUnit = property.hasOffice && rng() < 0.5;
  // Premium rent band kicks in when the unit has BOTH office and private
  // bathroom (per CLAUDE.md mock data calibration). Otherwise raw warehouse.
  const premium = hasBath && hasOfficeAtUnit;
  // Marisol: built-out (office+bath) units that are Modified Gross are
  // calibrated to the $27-30/sqft band anchored on the Harbor Park One sample
  // rent roll (Parkhurst county). Expansion markets are NOT
  // Marisol and keep the expansion premium band unchanged.
  const coreMarket = !sm.isExpansion;
  // Built-out Marisol units bias strongly toward Modified Gross (Harbor
  // Park One is MG). Other units keep the original independent assignment.
  const builtOutMg = premium && coreMarket;
  const leaseType: "NNN" | "MG" | "Gross" = builtOutMg ? "MG" : rng() > 0.85 ? "MG" : "NNN";
  let rentBand: [number, number];
  if (leaseType === "MG" && premium && coreMarket) {
    // Draw from the dedicated built-out MG band ($27-30/sqft Marisol).
    rentBand = [sm.mgBuiltOutLow, sm.mgBuiltOutHigh];
  } else if (premium) {
    rentBand = [sm.premiumRentLow, sm.premiumRentHigh];
  } else {
    rentBand = [sm.rawRentLow, sm.rawRentHigh];
  }
  const [rentLow, rentHigh] = rentBand;
  const ppsf = leased ? rentLow + (rentHigh - rentLow) * rng() : null;
  const annualRent = leased && ppsf !== null ? Number((ppsf * sizeSqft).toFixed(2)) : null;
  const monthlyRent = annualRent != null ? Math.round(annualRent / 12) : null;
  const startYearAgo = pickRange(rng, 0, 4);
  const termYears = pickRange(rng, 3, 5);
  const start = leased ? new Date(new Date(SEED_AS_OF).getTime() - startYearAgo * 365 * 86_400_000) : null;
  const end =
    leased && start
      ? new Date(start.getTime() + termYears * 365 * 86_400_000)
      : null;
  const tenant = leased ? pickFrom(rng, TENANT_TYPES) : null;
  // Internal-source (legacy portfolio) units have null tenantCategory: these
  // were acquired before the L1 capture solution existed and the category was
  // never recorded. The "pending capture" badge fires on these rows. Only
  // forward-fill sources (OM-ingested in oms.ts, L1-captured leads) carry
  // a real category.
  const tenantCategory = null;
  // Legacy vs KFP split: ~60% of leased units are "legacy" (pre-acquisition).
  const isLegacy = leased && rng() < 0.6;
  // Underwrite the in-place rent against the submarket market rent via the
  // engine. UW basis is market (not a flat discount), so performance to UW is
  // the real in-place-vs-market spread. Built-out (office + bath) units pick up
  // the higher built-out market band through getUwAssumptions.
  const market = getUwAssumptions(sm.name, {
    isBuiltOut: premium,
    isExpansion: sm.isExpansion,
  }).marketRentPsf;
  const uw = underwriteUnit({
    inPlaceRentPsf: ppsf, // null for vacant units
    marketRentPsf: market,
    sizeSqft,
    leaseStart: start ? start.toISOString() : null,
    rentGrowthPct: sm.isExpansion ? 0.035 : 0.05,
    asOf: SEED_AS_OF,
  });

  return {
    id: id("unit"),
    propertyId: property.id,
    suite: `${100 + i}`,
    sizeSqft,
    leaseType,
    hasPrivateBathroom: hasBath,
    currentRent: monthlyRent,
    rentPerSqft: ppsf ? Number(ppsf.toFixed(2)) : null,
    annualRent,
    leaseStart: start,
    leaseEnd: end,
    termYears: leased ? termYears : null,
    tenantName: tenant,
    tenantCategory,
    proportionateShareRsf: null as number | null, // assigned after totalLeasableSf is known
    legacyRent: isLegacy ? annualRent : null,
    kfpRent: !isLegacy && leased ? annualRent : null,
    legacyTermYears: isLegacy ? termYears : null,
    kfpTermYears: !isLegacy && leased ? termYears : null,
    legacySf: isLegacy ? sizeSqft : null,
    kfpSf: !isLegacy && leased ? sizeSqft : null,
    rentUw: uw.rentUw,
    trendedRentAtLease: uw.trendedRentAtLease,
    performanceToUw: uw.performanceToUw,
    leasedImpactUw: uw.leasedImpactUw,
    // Vacancy drag is the un-captured market rent on an empty unit; the engine
    // returns it for vacant rows and 0 for leased rows.
    vacancyImpactUw: uw.vacancyImpactUw,
    // Combined = NOI variance on this unit vs UW. For a leased row that's the
    // leased impact; for a vacant row that's the vacancy drag. Stored once so
    // the dashboard doesn't have to re-derive it in the UI.
    combinedImpactUw: uw.combinedImpactUw,
    annualRecoveryPsf: leased ? Number((1 + rng() * 2).toFixed(2)) : null, // $1-3/sqft NNN recovery
    securityDeposit: annualRent != null ? Number((annualRent / 12 * 2).toFixed(2)) : null,
  };
}
