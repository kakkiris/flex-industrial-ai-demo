# A1 Underwriting Methodology Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)
**Author:** FlexOps AI AI

## Goal

Replace A1's placeholder underwriting (a flat `rentUw = rent x 0.92`, which produced a meaningless constant +8.7% Performance-to-UW everywhere) with a faithful replication of how Keystone actually underwrites a property from a received OM or rent roll. Pull the deal-model figures into the Foundry (A5) property, and apply the same methodology to every property in A1 (synthetic portfolio, OM-ingested, runtime uploads, and Foundry).

## Background: how Keystone underwrites (from the client's acquisition UW workbook)

*Public-version note: deal figures are intentionally omitted from this spec; the committed seed data carries fictional values. The structure of the model is what matters.*

The acquisition model for Foundry Business Center (a recently closed ~two-dozen-tenant flex park) underwrites a flex value-add acquisition:

- **In-place rent** per suite from the rent roll: Modified Gross, in a narrow band, with a weighted average and a single vacant suite.
- **Market rent** from rent comps: a handful of regional industrial comps; the deal one-pager states a market rent band and an annual growth rate.
- **Value-add thesis:** demise units where feasible and lease at market rents. Leases roll from in-place toward market over the hold (Year 1 turned rent, then a higher Year 3 stabilized rent).
- **Acquisition:** purchase price and $/sqft basis, an implied **going-in cap** (in-place NOI / price), and acquisition costs as a % of price.
- **Capital:** CapEx to demise ($/sqft), plus TI, leasing commissions, and reserves ($/sqft), rolling up to a total effective all-in cost.
- **Returns:** Year 1 NOI; exit in a later hold year at an exit cap; selling costs as a % of sale price.

The load-bearing idea: **"Performance-to-UW" is in-place rent measured against underwritten market rent.** Foundry's weighted in-place rent sits *below* its underwritten market rent, i.e. acquisition upside. A flat 8.7% premium is the opposite of the real signal.

## Scope (confirmed)

- **Depth:** per-unit underwriting AND a property-level underwriting summary.
- **Coverage:** every property: synthetic KFP portfolio, the 3 OM-ingested properties, runtime OM uploads, and Foundry.
- **Foundry rents:** corrected to the in-place band from the deal rent roll (replacing the higher seeded built-out MG band).
- **Property-level metrics computed at read-time** (no new persisted columns, no migration).
- **No "modeled assumptions" caveat** in the UI. Foundry carries deal-model figures; other properties carry methodology-derived figures, presented the same way.

Out of scope: a full multi-year cash-flow pro forma / IRR (the model has it; A1 does not need it). Debt sizing, amortization, partnership waterfall.

## Architecture

A single underwriting engine that every ingestion path and the property-detail read both call, so the methodology is identical regardless of data source.

```
db/seed/_data.ts          -> per-submarket UW assumptions (market rent, basis $/sqft, opex, caps, growth)
lib/uw-assumptions.ts     -> assumptions accessor + Foundry deal override
lib/uw.ts                 -> underwriteUnit()  (per-unit, called at seed + ingest, persisted)
                          -> underwriteProperty() (property-level, called at read)
db/seed/units.ts          -> calls underwriteUnit for synthetic units
db/seed/oms.ts            -> calls underwriteUnit for OM units
db/seed/acquisition-bulk.ts -> Foundry: deal in-place rents + underwriteUnit
app/api/ingest-om/route.ts  -> calls underwriteUnit for runtime uploads
app/api/properties/[id]/units/route.ts -> calls underwriteProperty at read, returns `underwriting`
components/a1/CompDetailPanel.tsx -> per-unit in-place-vs-market + property UW summary block
```

### Component 1: UW assumptions (`db/seed/_data.ts` + `lib/uw-assumptions.ts`)

Each submarket row gains underwriting parameters; a Foundry override carries the deal-level inputs.

Per-submarket assumptions:
- `marketRentPsf` (the underwritten market rent benchmark; for Marisol built-out MG this is the comp benchmark, e.g. Parkhurst sits at the top of the band; Foundry's market is cheaper), plus `marketRentLow`/`marketRentHigh` for the displayed range.
- `acquisitionBasisPsf` (price per sqft, varies by submarket quality; Foundry uses its deal basis).
- `rentGrowthPct` by asset type (office `5%`, industrial `3.5%`; default per submarket).
- `opexLoadPct` / `recoveryPct` (Modified Gross: tenants reimburse most opex, so net opex is small; calibrated so Foundry reproduces the deal model's going-in cap).
- `vacancyPct` (stabilized vacancy assumption), `reservesPsf`, `acqCostPct`, `sellingCostPct`, `exitCapPct`, `capexToDemisePsf`.

`lib/uw-assumptions.ts` exposes `getUwAssumptions(submarket, assetType)` and `FOUNDRY_UW`, the deal-level **input** assumptions for the Foundry property: acquisition basis $/sqft (and so price), market rent band, rent growth, CapEx to demise $/sqft, reserves $/sqft, acquisition cost %, exit cap, and the calibrated opex/recovery factor. These are INPUTS only. `underwriteProperty` computes every OUTPUT (going-in cap, NOI, stabilized NOI, yield-on-cost) from these inputs via the same methodology used for every property; no outputs are hard-coded. The opex/recovery factor is calibrated so the methodology, fed Foundry's in-place rents plus the deal price, reproduces the deal model's going-in cap. That reproduction is the validation that the methodology is faithful.

### Component 2: `underwriteUnit` (per-unit, persisted)

Replaces the current `synthesizeOmUw` / `units.ts` UW block. Reuses the existing unit columns (no schema change):

Inputs: `inPlaceRentPsf` (null if vacant), `marketRentPsf`, `leaseStartDate`, `sizeSqft`, `assetType`, `asOf`.

- `rentUw = marketRentPsf` (the underwritten rent is market).
- `performanceToUw = inPlaceRentPsf == null ? null : (inPlaceRentPsf - marketRentPsf) / marketRentPsf`. Negative = below market (acquisition upside); positive = above market (rollover risk).
- `trendedRentAtLease = marketRentPsf * (1 + rentGrowthPct) ^ yearsSinceLeaseStart` (market trended from lease commencement).
- `leasedImpactUw = inPlaceRentPsf == null ? null : (inPlaceRentPsf - marketRentPsf) * sizeSqft` (annual $ above/below underwriting on leased space).
- `vacancyImpactUw = inPlaceRentPsf == null ? -marketRentPsf * sizeSqft : 0` (annual $ of market rent not yet captured on a vacant unit).
- `combinedImpactUw = (leasedImpactUw ?? 0) + vacancyImpactUw`.

These map 1:1 to Alex's rent-roll columns (Rent $/SF UW, Performance to UW, Trended Rent at Lease, Leased/Vacancy/Combined Impact), so A1's existing detail panel fields are populated with real meaning.

### Component 3: `underwriteProperty` (property-level, read-time)

Inputs: the property's units, the property submarket/assetType, `getUwAssumptions(...)`, `totalSqft`.

Computed:
- `inPlaceContractRent` = sum of in-place annual rent across leased units.
- `weightedInPlacePsf` = `inPlaceContractRent / leasedSqft`.
- `inPlaceNOI` = `inPlaceContractRent * (1 - opexLoadPct + recoveryPct) - reservesPsf * totalSqft` (Modified Gross: recoveries roughly offset opex; `opexLoadPct`/`recoveryPct` calibrated so Foundry hits the deal model's going-in cap).
- `acquisitionPrice` = `acquisitionBasisPsf * totalSqft`.
- `goingInCapPct` = `inPlaceNOI / acquisitionPrice`.
- `marketRentRange` = `[marketRentLow, marketRentHigh]`.
- `markToMarketUpsidePct` = `(marketRentPsf - weightedInPlacePsf) / weightedInPlacePsf`.
- `stabilizedNOI` = market-rolled NOI: `marketRentPsf * totalSqft * (1 - vacancyPct) * (1 - opexLoadPct + recoveryPct) - reservesPsf * totalSqft`, trended one growth period.
- `totalAllInCost` = `acquisitionPrice * (1 + acqCostPct) + capexToDemisePsf * totalSqft + reservesPsf * totalSqft` (+ TI/LC where known).
- `yieldOnCostPct` = `stabilizedNOI / totalAllInCost`.

Foundry runs through this SAME methodology. Its deal inputs (in-place rents from the deal rent roll, price / basis, market rent band, growth, CapEx) drive the computation; no outputs are hard-coded. The methodology reproduces the deal model's going-in cap as a validation, and computes `stabilizedNOI` from the mark-to-market roll plus growth, so stabilized NOI exceeds Year 1 NOI (the value-add upside). We use the methodology's computed stabilized NOI rather than the source model's headline stabilized figure, so the number is internally consistent with the Year 1 NOI.

### Component 4: Data corrections (Foundry)

`db/seed/extracted/acquisition-bulk-foundry.json` and `db/seed/acquisition-bulk.ts`: replace the modeled built-out MG rents with the in-place rents from the deal rent roll. The PSA-named tenants (fictionalized in this public version) are assigned the real per-suite rents by matching on unit RSF and position (the UW rent roll suites are anonymized "Existing Tenant"; the named tenants come from PSA Schedule 2). The monthly `Rent` charge in the six-table ETL output is recomputed from the corrected rate, so A5's emitted CommChargeSchedules also reflect the real rents.

### Component 5: A1 UI (`components/a1/CompDetailPanel.tsx` + read API)

- Per-unit (existing `UwComparison`): relabel to read as "In-place vs Market (Underwritten)". Performance-to-UW shows signed, color-coded so **below market is green** (upside) and above market is amber/red (rollover risk), inverting the current coloring to match the real signal.
- New **Underwriting** summary block on the property detail (driven by the `underwriting` object the read API now returns): going-in cap rate, market-rent range, mark-to-market upside %, Year 1 NOI, stabilized NOI, yield-on-cost, acquisition basis $/sqft. Presented as the property's underwriting snapshot, "how Keystone underwrites this property."
- `app/api/properties/[id]/units/route.ts` calls `underwriteProperty` and returns an `underwriting` field alongside the unit rows. No new DB columns.

## Data flow

1. Seed / ingest: each unit gets `marketRentPsf` from `getUwAssumptions(submarket, assetType)`, then `underwriteUnit` sets the persisted per-unit UW columns (in-place vs market based).
2. Foundry seed uses deal in-place rents; everything else uses its source rent (synthetic band draw or OM-extracted).
3. Read: the property-detail route loads units, calls `underwriteProperty` (or the Foundry override), and returns `underwriting` for the card.
4. Runtime OM upload: `ingest-om` runs the same `underwriteUnit` so uploaded properties are immediately methodology-consistent.

## Error handling

- Vacant units (`inPlaceRentPsf == null`): `performanceToUw` null, `vacancyImpactUw` carries the un-captured market rent. The detail panel already renders nulls gracefully.
- Missing assumptions for an unknown submarket (e.g. a runtime OM in a brand-new market): fall back to a documented default assumptions block (market rent = the unit's own extracted rent, basis = a default $/sqft), so the engine never throws. `underwriteProperty` returns a complete object with conservative defaults rather than partial data.
- Properties with zero leased units: `goingInCapPct` and `weightedInPlacePsf` guard against divide-by-zero (return null, UI shows a dash).

## Testing

- `lib/uw.ts`: `underwriteUnit` sets `rentUw = market`, `performanceToUw` negative when in-place below market, null when vacant; `underwriteProperty` computes going-in cap / NOI / yield from a fixture set of units.
- Foundry reproduction: a test seeds Foundry and asserts `underwriteProperty`, run via the methodology on the deal inputs, returns the deal model's going-in cap within a tolerance (the calibration validation) and that computed stabilized NOI exceeds Year 1 NOI (the value-add upside). The corrected in-place rents land in the deal's in-place band.
- Spread: synthetic built-out MG units produce a realistic distribution of `performanceToUw` (both above and below market), not a single constant.
- Regression: the existing A1 built-out-MG rent-band test (`[27, 30.5]`) stays green (rents unchanged; only UW interpretation changes). Search-comps aggregates unaffected.
- Read API: `properties/[id]/units` returns a populated `underwriting` object for Foundry and for a synthetic property.

## File structure

- Create: `lib/uw-assumptions.ts`, `tests/lib/uw.test.ts` (extend), `tests/api/property-underwriting.test.ts`.
- Modify: `lib/uw.ts`, `db/seed/_data.ts`, `db/seed/units.ts`, `db/seed/oms.ts`, `db/seed/acquisition-bulk.ts`, `db/seed/extracted/acquisition-bulk-foundry.json`, `app/api/ingest-om/route.ts`, `app/api/properties/[id]/units/route.ts`, `components/a1/CompDetailPanel.tsx`.
- No migration (read-time property metrics; per-unit reuses existing columns).

## Conventions

No em dashes. Master IDs. Team labels. The UW assumptions and Foundry override are documented in the doc surfaces that already cover A1 mock data (`CLAUDE.md` Mock Data Strategy, `solution_builds.md` A1 section) so the methodology is recorded, not just coded.
