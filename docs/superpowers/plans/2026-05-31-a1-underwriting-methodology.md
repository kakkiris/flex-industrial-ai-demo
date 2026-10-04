# A1 Underwriting Methodology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace A1's placeholder underwriting (flat `rent x 0.92` -> constant +8.7% everywhere) with a faithful replication of how Keystone underwrites from an OM/rent roll: per-unit in-place-vs-market and property-level going-in cap / NOI / yield-on-cost, applied to every property, with the deal-model inputs pulled into Foundry.

**Architecture:** One underwriting engine (`lib/uw.ts`) plus a per-submarket assumptions config (`lib/uw-assumptions.ts` + fields on `db/seed/_data.ts`). `underwriteUnit` runs at seed and at runtime OM ingest (persisted to existing unit columns); `underwriteProperty` runs at read in the property-detail API (no new columns, no migration). Foundry supplies real inputs; the engine computes all outputs the same way for every property.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Drizzle + SQLite, vitest. Spec: `docs/superpowers/specs/2026-05-31-a1-underwriting-methodology-design.md`.

---

## Conventions
- NO em dashes anywhere. No `any`. TDD. Frequent commits. Deterministic seed preserved.
- Reuse existing unit UW columns (`rentUw`, `performanceToUw`, `trendedRentAtLease`, `leasedImpactUw`, `vacancyImpactUw`, `combinedImpactUw`). No migration.
- Run from the repo root. Server must be stopped before any `pnpm build`. If a build breaks on a stale untracked file, check `git clean -fdn`.

## Reference data (from the client's acquisition UW workbook for the Foundry deal; not in this repo)

*Public-version note: deal figures are intentionally omitted here; the committed seed data (`lib/uw-assumptions.ts`, `db/seed/extracted/acquisition-bulk-foundry.json`) carries fictional values. Code snippets below use named placeholders where the original plan had deal numbers.*

**Foundry assumptions:** acquisition price and $/sqft basis over the property's total SF; a market rent band with a single benchmark; annual rent growth; CapEx to demise $/sqft; reserves $/sqft; acquisition cost %; exit cap; a weighted in-place rent; and the deal model's going-in cap (used as the calibration target).

**Foundry rent roll shape (per-suite in-place rents, MG; one vacant suite):** roughly two dozen suites from small units up to a few much larger units, several combined suites (e.g. two or three adjacent bays leased together), in-place rents in a narrow band below market.

Pattern: smaller suites rent slightly higher per sqft than larger suites. Deterministic mapping rule for the seed: each occupied Foundry tenant gets a `ratePsf` interpolated linearly by size between a top-of-band rate (smallest suite) and a bottom-of-band rate (largest suite), clamped to that band (reproduces the source range and size gradient). Keep the PSA-schedule tenant roster + security deposits unchanged (fictionalized in this public version).

---

## Task 1: UW assumptions config

**Files:**
- Modify: `db/seed/_data.ts` (add UW fields to `Submarket` + each row; correct the Foundry submarket's market band)
- Create: `lib/uw-assumptions.ts`
- Test: `tests/lib/uw-assumptions.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/lib/uw-assumptions.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { getUwAssumptions, FOUNDRY_UW } from "@/lib/uw-assumptions";

describe("getUwAssumptions", () => {
  it("returns the built-out MG market rent for a Marisol built-out unit", () => {
    const a = getUwAssumptions("Parkhurst", { isBuiltOut: true, isExpansion: false });
    expect(a.marketRentPsf).toBeGreaterThanOrEqual(27);
    expect(a.marketRentPsf).toBeLessThanOrEqual(30);
    expect(a.acquisitionBasisPsf).toBeGreaterThan(0);
    expect(a.rentGrowthPct).toBeCloseTo(0.05, 3);
  });
  it("returns the raw-warehouse market rent for a non-built-out unit", () => {
    const a = getUwAssumptions("Parkhurst", { isBuiltOut: false, isExpansion: false });
    expect(a.marketRentPsf).toBeLessThanOrEqual(20);
  });
  it("Foundry override carries the deal-level inputs", () => {
    expect(FOUNDRY_UW.acquisitionBasisPsf).toBeCloseTo(FOUNDRY_BASIS_PSF, 1);
    expect(FOUNDRY_UW.marketRentPsf).toBe(FOUNDRY_MARKET_RENT_PSF);
    expect(FOUNDRY_UW.capexToDemisePsf).toBeCloseTo(FOUNDRY_CAPEX_PSF, 1);
    expect(FOUNDRY_UW.rentGrowthPct).toBeCloseTo(FOUNDRY_RENT_GROWTH, 3);
  });
  it("falls back gracefully for an unknown submarket", () => {
    const a = getUwAssumptions("Nowhere", { isBuiltOut: true, isExpansion: false, fallbackRentPsf: 16 });
    expect(a.marketRentPsf).toBe(16);
    expect(a.acquisitionBasisPsf).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it, confirm fail.** Run: `pnpm test tests/lib/uw-assumptions.test.ts` -> FAIL (module not found).

- [ ] **Step 3: Add UW fields to `db/seed/_data.ts`.** Extend the `Submarket` type and every row with `acquisitionBasisPsf`, `capexToDemisePsf`. Correct the Foundry submarket's built-out band to its own market (Foundry's MG rents sit well below the Marisol core $27-30 band). Use these values:

```ts
// add to Submarket type:
acquisitionBasisPsf: number; // realistic flex acquisition $/sqft for the submarket
capexToDemisePsf: number;    // value-add CapEx $/sqft

// per-row additions (append to each existing row):
// Parkhurst:       acquisitionBasisPsf: 360, capexToDemisePsf: 15
// Calder:          acquisitionBasisPsf: 350, capexToDemisePsf: 15
// Westbrook:  acquisitionBasisPsf: 350, capexToDemisePsf: 15
// Brightwater:       acquisitionBasisPsf: 400, capexToDemisePsf: 12
// Ashby Beach:    acquisitionBasisPsf: 330, capexToDemisePsf: 18
// Foundry submarket:    acquisitionBasisPsf: FOUNDRY_BASIS_PSF, capexToDemisePsf: FOUNDRY_CAPEX_PSF  AND lower mgBuiltOutLow/High to its market band
// Kingsley:     acquisitionBasisPsf: 180, capexToDemisePsf: 10
// Orrington:          acquisitionBasisPsf: 190, capexToDemisePsf: 10
// Altamont:          acquisitionBasisPsf: 175, capexToDemisePsf: 10
```

Update the Foundry submarket comment to note its band is its own market (cheaper than Parkhurst), not a mirror of Marisol core.

- [ ] **Step 4: Create `lib/uw-assumptions.ts`:**

```ts
import { SUBMARKETS } from "@/db/seed/_data";

export type UwAssumptions = {
  marketRentPsf: number;
  marketRentLow: number;
  marketRentHigh: number;
  acquisitionBasisPsf: number;
  rentGrowthPct: number;
  noiMargin: number;       // in-place NOI as a fraction of in-place contract rent (MG recoveries offset opex)
  vacancyPct: number;      // stabilized vacancy
  reservesPsf: number;
  acqCostPct: number;
  capexToDemisePsf: number;
  exitCapPct: number;
};

const GLOBAL = {
  noiMargin: 1.0,
  vacancyPct: 0.05,
  reservesPsf: 0.25,
  acqCostPct: 0.015,
  exitCapPct: 0.07,
};

// Foundry deal inputs (fictional values live in the committed file). Outputs are NOT
// hard-coded; underwriteProperty computes them, reproducing the source model's going-in cap.
export const FOUNDRY_UW: UwAssumptions = {
  marketRentPsf: FOUNDRY_MARKET_RENT_PSF, marketRentLow: FOUNDRY_MARKET_LOW, marketRentHigh: FOUNDRY_MARKET_HIGH,
  acquisitionBasisPsf: FOUNDRY_BASIS_PSF, rentGrowthPct: FOUNDRY_RENT_GROWTH,
  capexToDemisePsf: FOUNDRY_CAPEX_PSF, ...GLOBAL,
};

export function getUwAssumptions(
  submarket: string,
  opts: { isBuiltOut: boolean; isExpansion: boolean; fallbackRentPsf?: number },
): UwAssumptions {
  const sm = SUBMARKETS.find((s) => s.name === submarket);
  if (!sm) {
    const market = opts.fallbackRentPsf ?? 16;
    return {
      marketRentPsf: market, marketRentLow: market * 0.9, marketRentHigh: market * 1.2,
      acquisitionBasisPsf: 180, rentGrowthPct: 0.04, capexToDemisePsf: 12, ...GLOBAL,
    };
  }
  const [low, high] =
    opts.isBuiltOut && !opts.isExpansion ? [sm.mgBuiltOutLow, sm.mgBuiltOutHigh]
    : opts.isBuiltOut ? [sm.premiumRentLow, sm.premiumRentHigh]
    : [sm.rawRentLow, sm.rawRentHigh];
  return {
    marketRentPsf: Number(((low + high) / 2).toFixed(2)),
    marketRentLow: low, marketRentHigh: high,
    acquisitionBasisPsf: sm.acquisitionBasisPsf,
    rentGrowthPct: sm.isExpansion ? 0.035 : 0.05,
    capexToDemisePsf: sm.capexToDemisePsf,
    ...GLOBAL,
  };
}
```

- [ ] **Step 5: Run test, confirm pass.** Run: `pnpm test tests/lib/uw-assumptions.test.ts` -> PASS.
- [ ] **Step 6: Commit.** `git add db/seed/_data.ts lib/uw-assumptions.ts tests/lib/uw-assumptions.test.ts && git commit -m "feat(a1): UW assumptions config with Foundry deal inputs"`

---

## Task 2: `underwriteUnit` (per-unit, market-based)

**Files:**
- Modify: `lib/uw.ts` (replace `synthesizeOmUw` internals; export `underwriteUnit`)
- Test: `tests/lib/uw.test.ts`

- [ ] **Step 1: Write the failing test** (add to `tests/lib/uw.test.ts`):

```ts
import { underwriteUnit } from "@/lib/uw";

describe("underwriteUnit", () => {
  const base = { marketRentPsf: 20, sizeSqft: 2000, leaseStart: "2023-01-01", rentGrowthPct: 0.05, asOf: "2026-01-01" };
  it("sets rentUw to market and performanceToUw negative when below market", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: 18 });
    expect(u.rentUw).toBe(20);
    expect(u.performanceToUw).toBeLessThan(0); // below market = upside
    expect(u.performanceToUw).toBeCloseTo((18 - 20) / 20, 4);
    expect(u.leasedImpactUw).toBeCloseTo((18 - 20) * 2000, 1);
  });
  it("performanceToUw positive when above market", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: 24 });
    expect(u.performanceToUw).toBeGreaterThan(0);
  });
  it("vacant unit: null performanceToUw, vacancyImpact carries un-captured market rent", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: null });
    expect(u.performanceToUw).toBeNull();
    expect(u.rentUw).toBe(20);
    expect(u.vacancyImpactUw).toBeCloseTo(-20 * 2000, 1);
  });
  it("trendedRentAtLease grows market from lease start", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: 18 });
    expect(u.trendedRentAtLease).toBeCloseTo(20 * Math.pow(1.05, 3), 2);
  });
});
```

- [ ] **Step 2: Run, confirm fail.** Run: `pnpm test tests/lib/uw.test.ts` -> FAIL (underwriteUnit not exported).

- [ ] **Step 3: Implement `underwriteUnit` in `lib/uw.ts`** (keep the existing `synthesizeOmUw` export as a thin wrapper that calls it, so current callers do not break mid-refactor):

```ts
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
```

- [ ] **Step 4: Run, confirm pass.** Run: `pnpm test tests/lib/uw.test.ts` -> PASS.
- [ ] **Step 5: Commit.** `git add lib/uw.ts tests/lib/uw.test.ts && git commit -m "feat(a1): underwriteUnit (in-place vs market)"`

---

## Task 3: `underwriteProperty` (property-level, read-time)

**Files:**
- Modify: `lib/uw.ts` (add `underwriteProperty`)
- Test: `tests/lib/uw.test.ts`

- [ ] **Step 1: Write the failing test** (add to `tests/lib/uw.test.ts`). The fixture mirrors Foundry (its total SF, weighted in-place rent, and basis) and asserts the going-in cap reproduces the deal model's cap within a tolerance and stabilized NOI exceeds in-place NOI:

```ts
import { underwriteProperty } from "@/lib/uw";
import { FOUNDRY_UW } from "@/lib/uw-assumptions";

describe("underwriteProperty", () => {
  // two units approximating Foundry: the leased sqft at the weighted in-place rent, plus one vacant suite
  const units = [
    { inPlaceRentPsf: FOUNDRY_IN_PLACE_PSF, sizeSqft: FOUNDRY_LEASED_SF },
    { inPlaceRentPsf: null, sizeSqft: FOUNDRY_VACANT_SF },
  ];
  it("reproduces the Foundry going-in cap and shows mark-to-market upside", () => {
    const p = underwriteProperty(units, FOUNDRY_UW, FOUNDRY_TOTAL_SF);
    expect(p.goingInCapPct).toBeGreaterThan(CAP_LOW);
    expect(p.goingInCapPct).toBeLessThan(CAP_HIGH);
    expect(p.markToMarketUpsidePct).toBeGreaterThan(0); // in-place below market
    expect(p.acquisitionPrice).toBeCloseTo(FOUNDRY_BASIS_PSF * FOUNDRY_TOTAL_SF, 0);
  });
  it("stabilized NOI exceeds in-place NOI (value-add upside)", () => {
    const p = underwriteProperty(units, FOUNDRY_UW, FOUNDRY_TOTAL_SF);
    expect(p.stabilizedNOI).toBeGreaterThan(p.inPlaceNOI);
    expect(p.yieldOnCostPct).toBeGreaterThan(0);
  });
  it("guards divide-by-zero for a fully vacant property", () => {
    const p = underwriteProperty([{ inPlaceRentPsf: null, sizeSqft: 1000 }], FOUNDRY_UW, 1000);
    expect(p.goingInCapPct).toBeNull();
    expect(p.weightedInPlacePsf).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail.** Run: `pnpm test tests/lib/uw.test.ts` -> FAIL (underwriteProperty not defined).

- [ ] **Step 3: Implement `underwriteProperty` in `lib/uw.ts`:**

```ts
import type { UwAssumptions } from "@/lib/uw-assumptions";

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
  return { inPlaceContractRent: Number(inPlaceContractRent.toFixed(0)), weightedInPlacePsf, inPlaceNOI,
    acquisitionPrice, goingInCapPct, marketRentLow: a.marketRentLow, marketRentHigh: a.marketRentHigh,
    markToMarketUpsidePct, stabilizedNOI, totalAllInCost, yieldOnCostPct, basisPsf: a.acquisitionBasisPsf };
}
```

- [ ] **Step 4: Run, confirm pass.** Run: `pnpm test tests/lib/uw.test.ts` -> PASS.
- [ ] **Step 5: Commit.** `git add lib/uw.ts tests/lib/uw.test.ts && git commit -m "feat(a1): underwriteProperty (going-in cap, NOI, yield-on-cost)"`

---

## Task 4: Wire the engine into the seeds (synthetic + OM + Foundry)

**Files:**
- Modify: `db/seed/units.ts` (synthetic), `db/seed/oms.ts` (OM), `db/seed/acquisition-bulk.ts` (Foundry), `db/seed/extracted/acquisition-bulk-foundry.json` (corrected rents)
- Modify: `lib/uw.ts` (point `synthesizeOmUw` at `underwriteUnit` using `getUwAssumptions`)
- Test: extend `tests/api/search-comps.test.ts` and `tests/db/acquisition-bulk-seed.test.ts`

- [ ] **Step 1: Write the failing tests.** In `tests/db/acquisition-bulk-seed.test.ts` add: Foundry occupied units have `rentPerSqft` inside the deal's in-place band (corrected from the higher seeded band) and `performanceToUw` (mark-to-market) is negative (below market) for most. In `tests/api/search-comps.test.ts` add: across synthetic Marisol built-out MG units, `performanceToUw` has BOTH negative and positive values (a real spread, not a constant 8.7%).

```ts
// acquisition-bulk-seed.test.ts
it("Foundry in-place rents sit in the deal band and read below market", () => {
  const rows = db.select({ rent: schema.units.rentPerSqft, perf: schema.units.performanceToUw })
    .from(schema.units).innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
    .where(eq(schema.properties.name, "Foundry Business Center")).all();
  const leased = rows.filter((r) => r.rent != null);
  for (const r of leased) { expect(r.rent!).toBeGreaterThanOrEqual(BAND_LOW); expect(r.rent!).toBeLessThanOrEqual(BAND_HIGH); }
  expect(leased.some((r) => (r.perf ?? 0) < 0)).toBe(true); // below market
});
// search-comps.test.ts
it("Performance-to-UW varies (not a constant) across the portfolio", () => {
  const vals = db.select({ p: schema.units.performanceToUw }).from(schema.units)
    .where(isNotNull(schema.units.performanceToUw)).all().map((r) => r.p!);
  const distinct = new Set(vals.map((v) => Math.round(v * 100)));
  expect(distinct.size).toBeGreaterThan(5); // real spread
  expect(vals.some((v) => v < 0)).toBe(true);
  expect(vals.some((v) => v > 0)).toBe(true);
});
```

- [ ] **Step 2: Run, confirm fail.** Run: `pnpm db:reset && pnpm test tests/db/acquisition-bulk-seed.test.ts tests/api/search-comps.test.ts` -> FAIL.

- [ ] **Step 3a: Correct the Foundry JSON rents.** In `db/seed/extracted/acquisition-bulk-foundry.json`, for each occupied lease set its rent rate per the deterministic size-gradient rule from the Reference data section (sizeSqft = the lease's unit sqft). Recompute each lease's monthly `Rent` charge = `round(sizeSqft * ratePsf / 12)` and `EstUtil` = `round(rent * 0.09)`. Keep tenant names, security deposits, unit codes, dates unchanged. (If the JSON stores annual rent or a rate field, update consistently so `fanOutToYardiTables` emits the corrected CommChargeSchedules.)

- [ ] **Step 3b: Point `synthesizeOmUw` at the engine** in `lib/uw.ts`. Replace its body so it derives market rent via `getUwAssumptions(submarket, { isBuiltOut, isExpansion })` and returns `underwriteUnit(...)` output mapped to the existing return shape. `isBuiltOut` = the OM unit has office+bathroom (or, if the OM lacks the flag, treat OM rent as already at market so `performanceToUw` is ~0). Pass `fallbackRentPsf = the unit's own rentPerSqft` so unknown submarkets do not throw.

- [ ] **Step 3c: Synthetic units** (`db/seed/units.ts`): replace the `rentUw = ppsf * (isLegacy ? 1.0 : 0.92)` block (lines ~86-88) with `const market = getUwAssumptions(sm.name, { isBuiltOut: premium, isExpansion: sm.isExpansion }).marketRentPsf; const uw = underwriteUnit({ inPlaceRentPsf: ppsf, marketRentPsf: market, sizeSqft, leaseStart: leaseStartIso, rentGrowthPct: sm.isExpansion ? 0.035 : 0.05, asOf });` and assign the unit's `rentUw/performanceToUw/trendedRentAtLease/leasedImpactUw/vacancyImpactUw/combinedImpactUw` from `uw`. Keep the legacy/KFP split for the OTHER columns; only the UW basis changes from a discount to market.

- [ ] **Step 3d: Foundry units** (`db/seed/acquisition-bulk.ts`): when building each occupied unit row, compute its UW via `underwriteUnit({ inPlaceRentPsf: correctedRatePsf, marketRentPsf: FOUNDRY_UW.marketRentPsf, sizeSqft, leaseStart, rentGrowthPct: FOUNDRY_UW.rentGrowthPct, asOf })` and set the UW columns. Vacant Foundry units pass `inPlaceRentPsf: null`.

- [ ] **Step 4: Run, confirm pass.** Run: `pnpm db:reset && pnpm test tests/db/acquisition-bulk-seed.test.ts tests/api/search-comps.test.ts` -> PASS. Then full `pnpm test` -> green.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(a1): seed UW via the methodology (synthetic, OM, Foundry in-place rents)"`

---

## Task 5: Runtime OM ingest uses the engine

**Files:**
- Modify: `app/api/ingest-om/route.ts`

- [ ] **Step 1:** Confirm `ingest-om` calls `synthesizeOmUw` (it does, per the existing OM path). Since Task 4 pointed `synthesizeOmUw` at the engine, runtime uploads are now methodology-consistent with no further change. Verify the call passes the submarket + built-out flag through (add them if the current call omits them).
- [ ] **Step 2: Build check.** Stop any running server, then run: `pnpm build` -> clean. Run `pnpm test tests/api/lease-extract.test.ts` and any ingest test -> green.
- [ ] **Step 3: Commit** if a change was needed: `git add app/api/ingest-om/route.ts && git commit -m "feat(a1): runtime OM ingest uses UW methodology"`

---

## Task 6: Property-detail API returns `underwriting`

**Files:**
- Modify: `app/api/properties/[id]/units/route.ts`
- Test: `tests/api/property-underwriting.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/api/property-underwriting.test.ts`): GET the route handler for the Foundry property id and a synthetic property id; assert the response includes an `underwriting` object with numeric `goingInCapPct`, `markToMarketUpsidePct`, `stabilizedNOI`, `yieldOnCostPct`, `basisPsf`, `marketRentLow/High`; and that Foundry's `goingInCapPct` falls in a tolerance band around the deal model's cap.

```ts
it("returns a populated underwriting object for Foundry", async () => {
  const prop = db.select().from(schema.properties).where(eq(schema.properties.name, "Foundry Business Center")).get();
  const res = await GET(new Request("http://t"), { params: Promise.resolve({ id: prop!.id }) });
  const json = await res.json();
  expect(json.underwriting).toBeDefined();
  expect(json.underwriting.goingInCapPct).toBeGreaterThan(CAP_LOW);
  expect(json.underwriting.goingInCapPct).toBeLessThan(CAP_HIGH);
  expect(json.underwriting.markToMarketUpsidePct).toBeGreaterThan(0);
  expect(typeof json.underwriting.yieldOnCostPct).toBe("number");
});
```
(Match the route's actual handler signature for params; check the file for whether it is `{ params }` sync or `Promise`.)

- [ ] **Step 2: Run, confirm fail.** Run: `pnpm test tests/api/property-underwriting.test.ts` -> FAIL.

- [ ] **Step 3: Implement.** In `app/api/properties/[id]/units/route.ts`, after loading the property + units, compute the assumptions and the property UW, and add `underwriting` to the JSON:

```ts
import { underwriteProperty } from "@/lib/uw";
import { getUwAssumptions, FOUNDRY_UW } from "@/lib/uw-assumptions";

const isFoundry = property.name === "Foundry Business Center";
const firstUnit = units[0];
const isBuiltOut = !!(property.hasOffice && firstUnit?.hasPrivateBathroom);
const assumptions = isFoundry
  ? FOUNDRY_UW
  : getUwAssumptions(property.submarket ?? "", {
      isBuiltOut, isExpansion: false,
      fallbackRentPsf: firstUnit?.rentPerSqft ?? 18,
    });
const totalSqft = property.totalSqft ?? units.reduce((s, u) => s + (u.sizeSqft ?? 0), 0);
const underwriting = underwriteProperty(
  units.map((u) => ({ inPlaceRentPsf: u.rentPerSqft, sizeSqft: u.sizeSqft ?? 0 })),
  assumptions, totalSqft,
);
// include `underwriting` in the returned JSON alongside the existing unit rows
```

- [ ] **Step 4: Run, confirm pass.** Run: `pnpm test tests/api/property-underwriting.test.ts` -> PASS. Full `pnpm test` -> green.
- [ ] **Step 5: Commit.** `git add app/api/properties/[id]/units/route.ts tests/api/property-underwriting.test.ts && git commit -m "feat(a1): property-detail API returns underwriting summary"`

---

## Task 7: A1 UI (per-unit relabel + property Underwriting block)

**Files:**
- Modify: `components/a1/CompDetailPanel.tsx`

- [ ] **Step 1: Per-unit relabel + recolor.** In `UwComparison`, relabel the comparison to "In-place vs Market (Underwritten)". Change the Performance-to-UW coloring so **negative (below market) renders green** (acquisition upside) and **positive (above market) renders amber/rose** (rollover risk), inverting the current convention. Keep Comp/Underwritten/Trended cells and the impact grid; "Underwritten" now means market rent. No em dashes.

- [ ] **Step 2: Property Underwriting block.** Add a new section to the property detail (fed by the `underwriting` object from the API) showing: Going-in cap rate (`goingInCapPct` as %), Market rent range (`$marketRentLow - $marketRentHigh /sqft`), Mark-to-market upside (`markToMarketUpsidePct` as %, green when positive), In-place NOI, Stabilized NOI, Yield-on-cost (`yieldOnCostPct` as %), Basis (`$basisPsf /sqft`). Use the existing card/tone tokens; no new colors or fonts. Label it as the property's underwriting snapshot. No "modeled" caveat.

- [ ] **Step 3: Build + visual check.** Stop server, run `pnpm build` -> clean and `pnpm lint` -> 0 errors. Start the prod server, open `/market-intelligence`, select a Foundry comp: confirm the Underwriting block shows the expected going-in cap and positive mark-to-market upside, and a below-market unit reads green.
- [ ] **Step 4: Commit.** `git add components/a1/CompDetailPanel.tsx && git commit -m "feat(a1): surface in-place-vs-market and property underwriting snapshot"`

---

## Task 8: Document the methodology

**Files:**
- Modify: `CLAUDE.md` (Mock Data Strategy: add an Underwriting subsection), `solution_builds.md` (A1 section: document the UW methodology + assumptions)

- [ ] **Step 1:** In `CLAUDE.md` Mock Data Strategy, add an "Underwriting" note: A1 derives underwriting the Keystone way (in-place vs comp-derived market rent; property going-in cap = in-place NOI / basis; yield-on-cost = stabilized NOI / all-in cost). Foundry uses its deal-level inputs (basis, market band, growth, CapEx) and reproduces the deal model's going-in cap. No em dashes.
- [ ] **Step 2:** In `solution_builds.md` A1 section, document `lib/uw.ts` + `lib/uw-assumptions.ts`, the per-unit and property-level outputs, and that property metrics are computed at read-time (no migration).
- [ ] **Step 3: Commit.** `git add CLAUDE.md solution_builds.md && git commit -m "docs(a1): document the underwriting methodology"`

---

## Task 9: Verify and report

- [ ] **Step 1:** Stop any server. `pnpm db:reset && pnpm test` -> all green; record the new count. `pnpm build` -> clean. `pnpm lint` -> 0 errors.
- [ ] **Step 2:** Em-dash check on the diff: `git diff <task1-base>..HEAD | grep '^+' | grep '—'` -> empty.
- [ ] **Step 3:** Curl: `GET /api/properties/<foundry-id>/units` shows `underwriting.goingInCapPct` near the deal model's cap and positive `markToMarketUpsidePct`; a synthetic property shows a computed (varying) cap. Confirm `performanceToUw` is no longer a constant across the portfolio.
- [ ] **Step 4:** Report: methodology live across all properties; Foundry corrected to its in-place rents, reproducing the deal model's going-in cap; per-unit Performance-to-UW now means in-place vs market; new test count.

---

## Self-Review

**Spec coverage:** assumptions config (T1) covers the methodology inputs + Foundry deal override; `underwriteUnit` (T2) + `underwriteProperty` (T3) are the engine; seed wiring (T4) covers synthetic + OM + corrected Foundry rents; ingest (T5) covers runtime; read API (T6) + UI (T7) surface per-unit and property-level; docs (T8); verify (T9). Coverage = everything (synthetic, OM, runtime, Foundry) per the spec. No migration (read-time property metrics; per-unit reuses existing columns).

**Type consistency:** `getUwAssumptions`/`UwAssumptions`/`FOUNDRY_UW` (T1) used in T3/T4/T6; `underwriteUnit`/`UnitUw` (T2) used in T4; `underwriteProperty`/`PropertyUw` (T3) used in T6. Field names (`goingInCapPct`, `markToMarketUpsidePct`, `stabilizedNOI`, `yieldOnCostPct`, `basisPsf`, `marketRentLow/High`) consistent across T3/T6/T7.

**Placeholder scan:** constants are concrete (basis $/sqft, capex, growth, noiMargin 1.0); the Foundry rent correction has a deterministic formula + the deal rent-roll shape; cap-rate assertions are ranges (robust to minor calibration). No TBD/TODO.
