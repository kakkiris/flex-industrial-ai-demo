# A1 Market Intelligence Dashboard: Current vs Demo Process

## Current Process (what KFP does today)

1. Alex maintains two portfolio rent roll files in Excel with a shared 54-column structure: identity, rent, UW comparison, legacy/KFP split, filters [Discovery-Alex 02:58, 03:33].
2. Every quarter, signed-lease and occupancy data is copy-pasted from Yardi into the rent roll files [Discovery-Alex 07:26].
3. The leasing team logs each new lease in the leasing tracker (date, asset, tenant, deal type, unit, previous rent, new rent, term, lease structure) [Discovery-Alex 10:42].
4. Alex tags each lease as legacy (pre-acquisition) or post-acquisition by hand on the rent roll [Discovery-Alex 04:46, 08:00].
5. Underwriting comparison: Alex trends the underwritten rent forward to each lease's start date at a growth rate, then computes performance-to-UW per unit [Discovery-Alex 03:33].
6. For new market evaluation, Alex and Jordan source OMs from CoStar, LoopNet, brokers; manually read each; copy useful comps into the master rent roll [Discovery-Jordan 14:06, Discovery-Alex 09:08].
7. For triple-net vs Modified Gross normalization, Alex adds operating expenses back to non-NNN leases so rent comparisons are apples-to-apples [Discovery-Alex 06:00].

## Demo Process (what this solution does)

1. Seeded KFP-profile portfolio (8 properties / 106 units) plus three ingested broker OMs (fictionalized) (Crestview, Uptown, Meridian = 3 properties / 86 units) load immediately on `/market-intelligence`. Real OMs come from pre-extracted JSON at `db/seed/extracted/` so `pnpm db:seed` is LLM-free. **(replaces)** Current step 2's quarterly copy-paste.
2. Filter sidebar exposes geo (dynamic from a `/api/submarkets` distinct-values lookup so OM-ingested submarkets appear automatically), unit size, asset type, lease type, plus **Bathroom Y/N**, **Office Y/N**, **Tenant Category** (multi-select from a `/api/tenant-categories` distinct-values lookup), **Clear Height** (range slider). All filters wire to `/api/search-comps` with consolidated WHERE clauses. **(replaces)** Manual Excel filtering across the rent roll tabs.
3. Bathroom premium delta: the search-comps aggregate computes median rent/sqft for units with private bathrooms vs without, within the current filter scope, and surfaces the spread as a header stat ("Bathroom premium: +$X.XX/sqft · with $Y vs without $Z median"). Jordan's pre-discovery question answered in the same view, no re-filter needed. **(new)**
4. "Ingest OM" runs the vision-path extraction pipeline on any uploaded PDF, inserting properties + units + compConfidence rows; on success the page fires a toast surfacing `propertyName` + `unitCount` + `submarket` and invalidates the search-comps, submarkets, and tenant-categories caches so the UI updates immediately. **(replaces)** Current step 6's manual OM read.
5. Confidence-tiered comp results with raw-quote citations linking to source PDFs (locally; graceful unavailability message in deployed environments where source PDFs are gitignored). **(new)**
6. Legacy vs KFP indicator on every unit derived from `legacyRent` / `kfpRent` columns populated at seed time, surfaced as a colored pill in the detail panel. **(augments)** Current step 4's manual tagging.
7. Yield-on-cost sensitivity table (first pass): the Property Underwriting section now leads with a yield-on-cost sensitivity grid, purchase price (rows) x stabilized rent per sqft (cols), each cell a yield-on-cost computed by the same `lib/uw.ts` engine (so the base cell matches the headline going-in / YoC figure), color-coded against a target yield, with a cost-to-stabilize sub-line and an assumptions footnote. Alex named this as his primary desired A1 output (a sensitivity table of yield-on-cost against purchase price) [Validation 2026-06-04], building on the underwriting need he described in discovery (yield-on-cost is what Victor cares about above all) [Discovery-Alex]. The block is badged "first pass": Alex's written underwriting spec, a second underwriting model, and ground-up development models are not yet provided. **(new)**
8. Underwriting Comparison section in the detail panel displays comp rent vs UW rent, trended-at-lease rent, deviation %, Performance-to-UW, Leased Impact, Vacancy Impact, and Combined Impact with a color-coded above/below flag. **(replaces)** Current step 5's manual trended-rent computation.
9. Tenant Category and Clear Height transparency: every row surfaces these fields with a "pending capture" italic badge where empty (acknowledged KFP data gaps until backfill). **(new)**
10. Aggregate header surfaces count, median PSF, min/max. **(augments)** Current step 1's manual rollup.

## Mapping

| Current Step | Demo Step | Relationship | Notes |
| --- | --- | --- | --- |
| 1 (maintain rent roll files) | 1 (seeded portfolio) | replaces | Demo seed mirrors the 54-column structure |
| 2 (quarterly Yardi copy-paste) | 1 (seeded) | replaces | Production would integrate via Yardi API |
| 3 (leasing tracker logging) | n/a | out of scope | Lives in current process; demo reads downstream of it |
| 4 (legacy vs post-acq tagging) | 6 (indicator) | augments | Demo presumes seed/extraction populates the split |
| 5 (UW comparison) | 8 (UW comparison section) | replaces | Side-by-side comparison + impact metrics surfaced in the detail panel |
| 6 (manual OM reading) | 4 (ingest-OM extraction) | replaces | Vision pipeline handles scanned OMs |
| 7 (NNN/MG normalization) | n/a | out of scope | Lease type filter surfaces the distinction; OpEx add-back deferred |
| new: yield-on-cost sensitivity | 7 (sensitivity table, first pass) | new | Alex's primary desired A1 output: price x stabilized rent/sqft grid of YoC + cost-to-stabilize [Validation 2026-06-04], [Discovery-Alex] |
| new: bathroom delta query | 3 (bathroom premium delta aggregate) | new | Jordan's pre-discovery question, answered in one view with median spread |
| new: data-gap transparency | 9 (pending-capture badges) | new | Tenant Category + Clear Height surfaced as empty rather than hidden |

## What the demo does NOT cover

- Quarterly Yardi sync (production needs a real integration; demo seeds the data).
- Operating expense add-back normalization for non-NNN leases.
- Backfill of Tenant Category and Clear Height on legacy portfolio units (pending capture from L1 / OM ingestion).
- Asset management presentations and the Victor weekly deck flow.
- Two-file portfolio rent roll split (the demo collapses into a single canonical table).
- The full underwriting model: the yield-on-cost sensitivity table is a first pass. Alex's written underwriting spec, a second underwriting model, and ground-up development models are not yet provided and are out of scope for this pass [Validation 2026-06-04].
