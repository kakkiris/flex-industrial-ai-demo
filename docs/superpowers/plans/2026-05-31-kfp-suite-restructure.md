# KFP Demo Suite Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the KFP demo suite per the 29-May feedback: split L2 into L2 (single-lease) + new A5 (acquisition bulk-load), reframe L1 (form backend) and A3 (visibility-only), strengthen C3 and A1, retire L3, and present the suite in two tiers, with all docs and tests brought back to green.

**Architecture:** One Next.js 15 app, shared SQLite (Drizzle + better-sqlite3), shared Anthropic client. A5 is a new acquisition-perspective demo that ingests a closing rent roll + unit inventory and emits the six linked Yardi commercial ETL tables (CommLeases, CommUnitXrefs, CommUnits, CommSQFTs, CommChargeSchedules, CommContacts) as a generated, zod-typed preview/export artifact, while also persisting vacant units as `units` rows and occupied leases as `leaseAbstracts` + FTS rows so C3 and L1 can query the inherited corpus and the empty-and-rentable shells. No new persisted ETL tables; Yardi stays a read-only destination.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, shadcn/ui, Drizzle ORM + better-sqlite3 + SQLite FTS5, Anthropic SDK (`claude-sonnet-4-6` default, `claude-opus-4-7` high-stakes), zod, vitest, react-query, sonner.

---

## Conventions (apply to every task)

- **No em dashes** anywhere: code, comments, UI copy, docs. Use commas, semicolons, periods.
- **Master IDs only** (A1-A5, L1-L6, C1-C3). This plan formally adds **A5** to the vocabulary (CLAUDE.md must be widened so A5 is not an "invented ID").
- **Perspective + Trigger** opens every solution doc. (No "beneficiary" field exists in the repo today; do NOT introduce a third required header field. Treat the brief's "+ beneficiary" as satisfied by naming who the trigger serves inside the Perspective line.)
- **Team labels** for anyone outside Jordan / Alex / Victor / Sam: Leasing team, Accounting team, Acquisitions team, Financing team, Property management team. (Scrub any stray individual names in the Solution Summary while retiring L3.)
- **Each current-vs-demo map lives in THREE synchronized places per demo**: the canonical `app/<route>/process.md` (four sections), the inline duplicate in `solution_builds.md` under `#### **Current vs Demo Process**`, and the index summary in `docs/process/current-vs-demo-mapping.md`. "Route README" in this repo = the per-route `process.md` + the top-level `README.md`; there are no per-route README files.
- **process.md four-section format:** `## Current Process (what KFP does today)` (numbered, with `[Discovery-Jordan HH:MM:SS]` / `[Discovery-Alex HH:MM:SS]` / `[Pre-discovery-KFP-initiatives]` / `[Rent roll structure]` citations); `## Demo Process (what this solution does)` (each step ends with bold `**(replaces)**` / `**(augments)**` / `**(new)**` / `out of scope`); `## Mapping` table (`Current Step | Demo Step | Relationship | Notes`); `## What the demo does NOT cover` (bullets).
- **No client data in repo.** Source PDFs/spreadsheets stay gitignored in the client-materials folder outside the repo; only pre-extracted JSON is committed under `db/seed/extracted/`.
- **Verification discipline:** never claim green without running `pnpm test` and `pnpm build`. Report the actual new test count (baseline was 97/97).

---

## Key Decisions (resolved; baked into the tasks below)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | A5 emits the six ETL tables as a **generated, zod-typed preview/export artifact** (tabbed preview + row counts + downloadable JSON), NOT six persisted Drizzle tables. For the cross-demo chain it also persists vacant units as `units` rows (tenantName null) and occupied/bulk-loaded leases as `leaseAbstracts` + `lease_sections_fts` rows (`source = "bulk_load"`). | Yardi is a read-only system of record; the six tables are a transient upload payload, not queryable app state. Mirrors the existing L2 "paste-ready output" pattern. Avoids bloating the schema with 120/164-column mirrors and a migration. Means **zero new migrations**. |
| D2 | A5 worked example = the **Foundry deal** (a recently closed ~two-dozen-tenant flex park), using the tenant roster + security deposits + unpaid leasing costs from the PSA tenant schedule (fictionalized in this public version), fanned out into the reference property six-table format. Committed as `db/seed/extracted/acquisition-bulk-foundry.json`; source files gitignored. | The brief names Foundry as the worked example and the reference property as the format reference. The Foundry rent-roll spreadsheet itself was only an attachment reference in the PSA, so rents/sqft/dates are modeled realistically off the REF-0001 export and Harbor Park One ranges. |
| D3 | Route = `/app/acquisition-bulk-load/`, components in `components/a5/`, API under `app/api/acquisition/`. Sidebar under Acquisitions; home card id `A5`, status `BUILD PARTIAL` ("needs Yardi access"). | Matches the descriptive-kebab route convention (A1 = /market-intelligence). |
| D4 | Keep `units.tenantName IS NULL` = available. No new `units.status` column. | Cheapest; matches the only existing vacancy query (`app/api/chat/leasing/route.ts:33`). |
| D5 | `leaseAbstracts.source` gains the value `"bulk_load"`. `source` is plain TEXT (no DB enum), so **no migration** is required, only a TypeScript union widening + the zod/StatusGrid unions. | SQLite text column. |
| D6 | C3's "8 questions" = 8 FlexOps AI-curated example prompts grounded in [Discovery-Jordan] and the Jordan synthesis pass (no verbatim client list exists). Final 8: (1) HVAC responsibility for a tenant, (2) per-property tenant expiration schedule [structured], (3) leases expiring next quarter, (4) compare net effective rents, (5) lender consent / loan docs for a lease, (6) renewal options summary, (7) free rent in year 1, (8) TI allowance > $10/sqft. Plus the A5-fed "what is empty and rentable" availability query. | Brief item 4. Label them "example prompts grounded in Jordan's stated use cases", not a verbatim list. |
| D7 | A5 live API path is a **simulated bulk-upload** (select the worked example -> emit + persist), no live `.xls` parse, no new SheetJS dependency. The committed JSON drives the demo, exactly like A1's pre-extract model. | Consistent with "needs Yardi access"; the six real `.xls` are format references only (their schema was extracted offline into this plan). |
| D8 | Retire L3 = rewrite its mentions (CLAUDE.md Phase-2 line, Master Solution Summary row, current-vs-demo-mapping rollup), keep the 5+ hrs/week pain point as A5/L2 justification, scrub stray individual names. Do NOT touch the unrelated Jordan synthesis-pass L3 (= "Internal Lease Chat Interface", a different meaning). | Brief item 1. |
| D9 | A3 closing milestone = presentational. Add a 5th `DealTimeline` node "Bulk-load to Yardi (A5)" and a handoff card on `closing`/`closed` deals that links to `/acquisition-bulk-load`. Keyed off existing `deals.status`; **no new column**. | Brief item 3; avoids a migration. |
| D10 | Tiering UI = group the home `StatusGrid` into "Tier 1 - Validated headliners" (A1, C3, L2, A5) and "Tier 2 - We heard you (reframed)" (L1, A3), with a short "we heard you" line on Tier 2 cards. Solution Summary table gains a `Tier` column. | Brief item 5; do not silently drop declined items. |

---

## Source-Data Appendix (ground truth for A5 and A1; do not re-derive)

**The six Yardi ETL tables** (a real client export for one reference property, parsed offline from the six `.xls` files; the reference property code is shown here as `REF-0001`). Keyed on `Property_Code` + `Lease_Code` (+ `Unit_Code` for unit-level tables). Load-bearing columns A5 must emit (model the abstraction surface, NOT the full 120/164-col headers):

- **CommLeases** (full header 120 cols): `Property_Code`, `Lease_Code` (e.g. `t0004412`), `Lease_Name` (tenant legal name), `Lease_Type` (`modgrs` = Modified Gross), `Lease_Start_Date`, `Lease_End_Date`, `Lease_Move_In_Date`, `Contracted_Area`, `Customer_Code`, `Company_Name`. Dates are Excel serials (e.g. 44805 = 2022-09-01); store ISO in JSON.
- **CommUnitXrefs** (16 cols): `Property_Code`, `Lease_Code`, `Unit_Code` (e.g. `412-1`), `Unit_Start_Date`, `Unit_End_Date`, `Unit_Move_in_Date`, `Status`. Links leases to units (a lease can span multiple units).
- **CommUnits** (49 cols): `Property_Code`, `Unit_Code`, `Rental_Type` (`Commercial`), `Bldg_Code`, `Address_1`, `City`, `State`, `Zip_Code`, `Rent`, `SQFT`, `Unit_Type`, `Lease_Type`. The full unit inventory (occupied + vacant).
- **CommSQFTs** (22 cols): `Property_Code`, `Unit_Code`, `DTDATE`, `DSQFT0`..`DSQFT15` (sqft measures; `DSQFT0` is the primary), `Notes`. e.g. unit `412-1` = 1300 sqft.
- **CommChargeSchedules** (164 cols): `Property_Code`, `Lease_Code`, `Charge_Code` (`Rent` and `EstUtil` are the two real codes; modified-gross leases carry both), `Schedule_From_Date`, `Schedule_To_Date`, `Amount` (monthly, e.g. 2450.00), `Amount_Period`, `Description`. One Rent row + one EstUtil row per occupied lease.
- **CommContacts** (39 cols): `Contact_Type_Association`, `Record_Code` (= `Lease_Code`), `Role_Description` (`Billing`), `First_Name`, `Last_Name`, `Company_Name`, `PhoneNumber_1`, `Email`. One Billing contact per lease.

Fan-out invariants: **occupied unit -> 1 CommLeases + 1+ CommUnitXrefs + 1+ CommUnits + 1+ CommSQFTs + 1+ CommChargeSchedules + 1 CommContacts.** **Vacant unit -> CommUnits + CommSQFTs ONLY (a "shell"), no Lease_Code.** Property REF-0001 reference proportions: a few dozen leases, a unit inventory with a sizable share of vacant shells, two charges (Rent+EstUtil) and one billing contact per lease; all `modgrs`; small flex units.

**Foundry deal** (worked example; from the deal set: PSA, closing statement, OM, LOI). *Public-version note: all tenant names, amounts, locations, and deal figures are fictionalized; the originals are not reproduced here. See the seed data for the committed values.*
- Property: **Foundry Business Center**, a recently closed ~two-dozen-tenant flex park, nearly fully occupied, with a mix of small units and a few larger units.
- Deal: a recent acquisition held in a KFP single-asset LLC; the PSA supplies the earnest-money deposit and DD timeline; **Jordan Reyes** is the LOI signatory.
- **Tenants + security deposits (PSA tenant schedule)**: the named tenants (a mix of LLCs, corporations, and a few individuals), each with a security deposit, plus a total deposit credit to buyer. The committed JSON carries a fictionalized roster.
- **Unpaid leasing costs (PSA tenant schedule):** a couple of leases carry unpaid TI allowance, leasing commission, or landlord-work costs. To be carried as a note/payload, not a CommLeases column.
- To demo the vacant-shell path, author the named tenants as occupied leases plus a few vacant units (the source property is nearly fully occupied; **flag in process.md "What the demo does NOT cover" that vacant counts are illustrative**). That yields the full inventory.

**A1 rent recalibration** (from "the sample populated rent roll", 54-col rent roll): Harbor Park One = **Westbrook, Office Y + Bathroom Y, Modified Gross, built-out, target $27-30/sqft**. The 54-col structure includes Performance to UW, Trended Rent at Lease, Leased/Vacancy/Combined Impact, Legacy/KFP split, and Tenant Category + Clear Height columns that are genuinely empty (forward-fill).

---

## Stream 0: Branch, gitignore, housekeeping

Branch `feat/kfp-suite-restructure` is already created off `feat/kfp-demo-suite`.

### Task 0.1: Gitignore the new client source files

**Files:** Modify `/.gitignore` (repo root)

- [ ] **Step 1:** Append a block to the root `.gitignore` after the existing "Real client OM and lease PDFs" block:

```gitignore
# Foundry acquisition source set + Yardi ETL samples + rent roll references (delivered 2026-05-30, kept local)
# (one line per client filename: the PSA, closing statement, OM, LOI, UW workbook,
#  populated rent roll, rent roll template, and the six Yardi ETL .xls exports;
#  actual filenames omitted from this public version)
```

- [ ] **Step 2:** Verify none are tracked and all are now ignored:

Run: `git check-ignore` against each of the new client filenames from the client-materials folder.
Expected: each path echoed back (ignored).

### Task 0.2: Delete Finder duplicate artifacts

**Files:** Delete `components/a3/BlockerCenter 2.tsx`, `components/c3/LeaseIntelligenceClient 2.tsx`, `db/kfp-demo 2.db`, `db/kfp-demo 2.db-wal`, `db/kfp-demo 3.db`, `db/kfp-demo 3.db-wal`, `db/kfp-demo 4.db`

- [ ] **Step 1:** Confirm the `" 2.tsx"` files are byte-identical-ish stale copies (never imported) before deleting:

Run: `cd "the repo root" && grep -rn "BlockerCenter 2\|LeaseIntelligenceClient 2" app components || echo "not imported, safe to delete"`
Expected: "not imported, safe to delete".

- [ ] **Step 2:** Delete the duplicates:

Run: `cd "the repo root" && rm -f "components/a3/BlockerCenter 2.tsx" "components/c3/LeaseIntelligenceClient 2.tsx" "db/kfp-demo 2.db" "db/kfp-demo 2.db-wal" "db/kfp-demo 3.db" "db/kfp-demo 3.db-wal" "db/kfp-demo 4.db"`

- [ ] **Step 3:** Extend `.gitignore` so future Finder copies of the dev DB are ignored. Add under the Database block:

```gitignore
db/kfp-demo*.db
db/kfp-demo*.db-wal
db/kfp-demo*.db-shm
db/kfp-demo*.db-journal
```

### Task 0.3: Establish the green baseline

- [ ] **Step 1:** Install deps and reset the DB:

Run: `cd "the repo root" && pnpm install && pnpm db:reset`
Expected: migrations apply, seed completes, FTS index written.

- [ ] **Step 2:** Run the suite and record the baseline:

Run: `cd "the repo root" && pnpm test 2>&1 | tail -20`
Expected: 97 passing (the documented baseline). Record the exact number; every later stream re-checks against it.

- [ ] **Step 3:** Commit the housekeeping:

```bash
cd "the repo root"
git add -A
git commit -m "chore(restructure): gitignore Foundry/ETL source files, drop Finder dupes"
```

---

## Stream A: A1 strengthen (rent recalibration + Performance-to-UW)

A1 mock rents are generated in `db/seed/_data.ts` (band table) + `db/seed/units.ts` (picker). Today the rent band is chosen by a unit-level premium flag (`hasBath && hasOfficeAtUnit`), **decoupled from lease type**, so a built-out MG unit can land anywhere in the raw $13-20 band, and `leaseType` is assigned independently (`rng() > 0.85 ? "MG" : "NNN"`). Performance-to-UW is computed (`units.ts:86-88`, `lib/uw.ts:44`) and stored but is **not surfaced as a named value**; only "Deviation" shows in `CompDetailPanel`.

### Task A.1: Couple built-out Modified-Gross units to the $27-30/sqft band

**Files:** Modify `db/seed/_data.ts` (band table), `db/seed/units.ts:60-95` (picker + leaseType), `db/seed/properties.ts:15-16` (Westbrook anchor); Test `tests/api/search-comps.test.ts`

- [ ] **Step 1: Write the failing test** in `tests/api/search-comps.test.ts` (new case): query the seeded DB for units that are Modified Gross AND built-out (hasPrivateBathroom = 1 AND property hasOffice = 1) and assert their `rentPerSqft` falls in [27, 30], and that at least one such unit exists in a Parkhurst / Westbrook submarket.

```ts
it("built-out Modified Gross units are calibrated to $27-30/sqft (Harbor Park One)", async () => {
  const rows = db
    .select({ rent: schema.units.rentPerSqft, leaseType: schema.units.leaseType, bath: schema.units.hasPrivateBathroom })
    .from(schema.units)
    .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
    .where(and(eq(schema.units.leaseType, "MG"), eq(schema.properties.hasOffice, true), eq(schema.units.hasPrivateBathroom, true)))
    .all();
  const builtOutMg = rows.filter((r) => r.rent != null);
  expect(builtOutMg.length).toBeGreaterThan(0);
  for (const r of builtOutMg) {
    expect(r.rent!).toBeGreaterThanOrEqual(27);
    expect(r.rent!).toBeLessThanOrEqual(30.5); // small tolerance for the RNG jitter
  }
});
```

- [ ] **Step 2: Run it to confirm it fails:** `pnpm test tests/api/search-comps.test.ts` -> FAIL (built-out MG rents land in the raw/premium band, not 27-30).

- [ ] **Step 3: Implement.** In `db/seed/_data.ts`, add a dedicated built-out-MG band to the Marisol submarket rows (especially Westbrook, home of Harbor Park One), e.g. `mgBuiltOutLow: 27, mgBuiltOutHigh: 30`. In `db/seed/units.ts`, change the rent pick so that when `leaseType === "MG"` AND the unit is built out (`hasBath && hasOfficeAtUnit`), the rent is drawn from `[mgBuiltOutLow, mgBuiltOutHigh]`; otherwise keep the existing premium/raw logic. Couple `leaseType` so built-out Marisol units bias to MG (Harbor Park One is MG). Keep expansion-market and raw-warehouse bands unchanged so the legacy/KFP split and other markets are not disturbed.

Concretely in `units.ts` (replace the band pick around lines 60-70 and the leaseType line at 95):

```ts
const premium = hasBath && hasOfficeAtUnit;
const builtOutMg = premium && coreMarket; // coreMarket derived from sm.county / submarket
// Built-out Marisol units are Modified Gross in the real Harbor Park One data
const leaseType: "NNN" | "MG" | "Gross" = builtOutMg ? "MG" : rng() > 0.85 ? "MG" : "NNN";
let rentBand: [number, number];
if (leaseType === "MG" && premium && coreMarket) rentBand = [sm.mgBuiltOutLow, sm.mgBuiltOutHigh];
else if (premium) rentBand = [sm.premiumRentLow, sm.premiumRentHigh];
else rentBand = [sm.rawRentLow, sm.rawRentHigh];
const [rentLow, rentHigh] = rentBand;
const ppsf = leased ? Number((rentLow + (rentHigh - rentLow) * rng()).toFixed(2)) : null;
```

- [ ] **Step 4:** Reseed and re-run: `pnpm db:reset && pnpm test tests/api/search-comps.test.ts` -> PASS.

### Task A.2: Surface Performance-to-UW prominently in the detail panel

**Files:** Modify `components/a1/CompDetailPanel.tsx` (UwComparison block, lines 102-190)

- [ ] **Step 1:** Add an explicit, labeled "Performance to UW" hero figure to the `UwComparison` section, rendered as a signed percentage with a color-coded above/below flag (green >= 0, red < 0), computed from `unit.performanceToUw` (fall back to the existing deviation derivation when `performanceToUw` is null). Keep the existing Comp / Underwritten / Trended cells and the 3-cell impact grid; promote Performance-to-UW to the top alongside (or above) Deviation so it reads as the headline. No em dashes in labels.

- [ ] **Step 2:** Visual check (manual): `pnpm dev`, open `/market-intelligence`, select a comp, confirm "Performance to UW" shows as a named, color-coded value. (Document in the task as a manual check; no unit test for layout.)

- [ ] **Step 3:** `pnpm build` -> clean. Commit:

```bash
git add -A && git commit -m "feat(a1): calibrate built-out MG units to \$27-30/sqft, surface Performance-to-UW"
```

(Tenant Category + Clear Height already render a "pending capture" badge in `CompDetailPanel.tsx:318-325,354-361` and `CompsTable.tsx:166-188`; leave them forward-fill-only. Add a `search-comps.test.ts` assertion that an OM/legacy row keeps `tenantCategory`/`clearHeightFt` null with the badge path intact, to lock the genuine-gap behavior.)

---

## Stream B: L2 narrow to the single-lease Yardi-UI path

L2's dual-path extraction, ~15-field abstract, confidence flags, synchronous FTS write, DocuSign sim, review/approve queue, and C3 cross-link all survive. Only the framing/copy changes: trigger becomes "a new lease signed on an already-owned property", and the workflow is narrated as the Yardi UI sequence (create lease -> attach billing contact -> add unit -> build charge schedules -> activate; one person, create-through-activate). The "paste-ready rent-roll-column" surface stays L2's; the bulk/six-table path is explicitly A5's.

### Task B.1: Reframe L2 page + narrative copy

**Files:** Modify `app/lease-abstraction/page.tsx:49-55` (header), `components/l2/WorkflowNarrative.tsx`, `components/l2/PushToYardiModal.tsx` (label only)

- [ ] **Step 1:** Rewrite the L2 header subtitle and `WorkflowNarrative` to the single-lease Yardi-UI framing. Map the abstract editor stages to the five Yardi UI steps (create lease, attach billing contact, add unit, build charge schedules, activate). State explicitly that this is the single-lease path and that closing/bulk inheritance is A5. No em dashes.
- [ ] **Step 2:** In `PushToYardiModal`, keep the column-mapped paste-ready output; adjust copy so it reads as "the fields one person keys create-through-activate", not a portfolio dump.
- [ ] **Step 3:** `pnpm build` -> clean.

### Task B.2: Update L2 process.md (canonical) and the two duplicates

**Files:** Modify `app/lease-abstraction/process.md`, `solution_builds.md` (L2 section L865-1005 + its inline Current-vs-Demo dup), `docs/process/current-vs-demo-mapping.md:57-69`

- [ ] **Step 1:** Rewrite `app/lease-abstraction/process.md`: Current Process unchanged; Demo Process re-tagged to the Yardi-UI single-lease narrative; add to "What the demo does NOT cover" that bulk acquisition inheritance is A5's path. Keep all four sections.
- [ ] **Step 2:** Mirror into `solution_builds.md` L2 section (narrow the trigger to "new lease signed on an already-owned property", add the create-through-activate framing, note "Foundation for C3 (with A5)") and into `current-vs-demo-mapping.md`.
- [ ] **Step 3:** Commit:

```bash
git add -A && git commit -m "docs(l2): reframe to single-lease Yardi-UI path, A5 owns the bulk path"
```

(L2 tests: `extract-lease.test.ts` / `lease-extract.test.ts` keep their field assertions and the exact-3-FTS-rows assertion; trim any field that exceeds the ~15-20 abstraction surface. Do NOT change the FTS write path.)

---

## Stream C: A5 new (Acquisition Lease Bulk-Load) [largest stream]

Build A5 from scratch using A1's ingest pattern (`app/api/ingest-om/route.ts`), the multi-table single-transaction fan-out (`app/api/onboarding/extract-psa/route.ts:82-125`), the FTS-via-raw-sqlite write (`app/api/lease/extract/route.ts:90-103`), and the pre-extract-then-commit-JSON seed pattern (`db/seed/oms.ts`). A5 emits the six ETL tables as a generated artifact AND persists vacant units + occupied leases so C3/L1 can query them.

### Task C.1: Define the six-table ETL types + transform (zod)

**Files:** Create `lib/etl/yardi-tables.ts` (zod schemas + types), `lib/etl/fan-out.ts` (the deterministic transform); Test `tests/lib/yardi-fanout.test.ts`

- [ ] **Step 1: Write the failing test** in `tests/lib/yardi-fanout.test.ts`: given a small `ClosingRentRoll` input (2 occupied leases on 3 units + 1 vacant unit), `fanOutToYardiTables(input)` returns the six arrays such that: every occupied lease has exactly 1 CommLeases row, >=1 CommUnitXrefs, a CommUnits + CommSQFTs per unit, >=1 CommChargeSchedules (Rent), and exactly 1 Billing CommContacts; the vacant unit produces a CommUnits + CommSQFTs row and **no** CommLeases/Xref/Charge/Contact; and **every** row carries `Property_Code`, with lease-scoped rows carrying `Lease_Code` and unit-scoped rows carrying `Unit_Code`.

```ts
import { describe, it, expect } from "vitest";
import { fanOutToYardiTables } from "@/lib/etl/fan-out";

const input = {
  propertyCode: "REF-0002",
  property: { address1: "100 Example Way", city: "Olmstead", state: "TX", zip: "00000" },
  leases: [
    { leaseCode: "t1", leaseName: "Tenant A LLC", leaseType: "modgrs", startDate: "2023-01-01", endDate: "2027-12-31",
      securityDeposit: 3000, units: [{ unitCode: "101", sqft: 1300 }], charges: [{ code: "Rent", amount: 2900 }, { code: "EstUtil", amount: 180 }],
      billingContact: { firstName: "", lastName: "Tenant A LLC", company: "Tenant A LLC", phone: "", email: "" } },
    { leaseCode: "t2", leaseName: "Tenant B LLC", leaseType: "modgrs", startDate: "2024-06-01", endDate: "2029-05-31",
      securityDeposit: 3500, units: [{ unitCode: "102", sqft: 1500 }, { unitCode: "103", sqft: 1500 }], charges: [{ code: "Rent", amount: 6500 }, { code: "EstUtil", amount: 360 }],
      billingContact: { firstName: "", lastName: "Tenant B LLC", company: "Tenant B LLC", phone: "", email: "" } },
  ],
  vacantUnits: [{ unitCode: "104", sqft: 1200 }],
};

it("fans an occupied lease across all six tables and a vacant unit into a 2-table shell", () => {
  const t = fanOutToYardiTables(input);
  expect(t.commLeases).toHaveLength(2);
  expect(t.commUnitXrefs).toHaveLength(3); // t1:1 + t2:2
  expect(t.commUnits).toHaveLength(4);     // 3 occupied + 1 vacant
  expect(t.commSqfts).toHaveLength(4);
  expect(t.commChargeSchedules).toHaveLength(4); // 2 charges x 2 leases
  expect(t.commContacts).toHaveLength(2);
  // vacant shell: unit 104 has a CommUnits + CommSQFTs row but no lease linkage
  expect(t.commUnitXrefs.find((x) => x.Unit_Code === "104")).toBeUndefined();
  expect(t.commUnits.find((u) => u.Unit_Code === "104")).toBeDefined();
  // keying invariant
  for (const r of t.commLeases) { expect(r.Property_Code).toBe("REF-0002"); expect(r.Lease_Code).toBeTruthy(); }
  for (const r of t.commUnits) { expect(r.Property_Code).toBe("REF-0002"); expect(r.Unit_Code).toBeTruthy(); }
});
```

- [ ] **Step 2: Run it to confirm it fails:** `pnpm test tests/lib/yardi-fanout.test.ts` -> FAIL (module not found).

- [ ] **Step 3: Implement `lib/etl/yardi-tables.ts`** with zod schemas for the six tables, modeling the abstraction-surface columns from the Source-Data Appendix (exact column names: `Property_Code`, `Lease_Code`, `Lease_Name`, `Lease_Type`, `Lease_Start_Date`, `Lease_End_Date`, `Lease_Move_In_Date`, `Contracted_Area`, `Security_Deposit` on CommLeases; `Unit_Code`, `Unit_Start_Date`, `Unit_End_Date`, `Status` on CommUnitXrefs; `Rental_Type`, `Address_1`, `City`, `State`, `Zip_Code`, `Rent`, `SQFT`, `Unit_Type`, `Lease_Type` on CommUnits; `DTDATE`, `DSQFT0`, `Notes` on CommSQFTs; `Charge_Code`, `Schedule_From_Date`, `Schedule_To_Date`, `Amount`, `Amount_Period`, `Description` on CommChargeSchedules; `Contact_Type_Association`, `Record_Code`, `Role_Description`, `First_Name`, `Last_Name`, `Company_Name`, `PhoneNumber_1`, `Email` on CommContacts). Export a `ClosingRentRoll` input type and a `YardiEtlTables` output type.

- [ ] **Step 4: Implement `lib/etl/fan-out.ts`** with `fanOutToYardiTables(input: ClosingRentRoll): YardiEtlTables` realizing the fan-out invariants (occupied -> 6 tables; vacant -> CommUnits + CommSQFTs only). Charge codes `Rent` + `EstUtil` for `modgrs`. One Billing contact per lease.

- [ ] **Step 5:** `pnpm test tests/lib/yardi-fanout.test.ts` -> PASS. Commit.

### Task C.2: Author the Foundry dataset (pre-extracted JSON) + seed loader

**Files:** Create `db/seed/extracted/acquisition-bulk-foundry.json`, `db/seed/acquisition-bulk.ts`; Modify `db/seed/index.ts` (wipe order + insert), `db/seed/_data.ts` (add the Foundry submarket), `db/seed/README.md` (fixtures table)

- [ ] **Step 1:** Author `db/seed/extracted/acquisition-bulk-foundry.json` as a `ClosingRentRoll` for Foundry using the Source-Data Appendix: the Foundry property, the named tenants (fictionalized) as occupied `modgrs` leases with their security deposits, realistic rents (model built-out MG units on small-unit sizes, plus a few larger units for the tenants with larger deposits), 5-year terms with realistic staggered start/end dates, one Billing contact per lease, Rent + EstUtil charges; plus a few vacant units as shells. Carry the unpaid leasing costs as a `notes`/`unpaidLeasingCosts` field on those leases. Choose a synthetic Property_Code distinct from REF-0001.

- [ ] **Step 2:** Implement `db/seed/acquisition-bulk.ts` `buildAcquisitionBulkSeed()`: read the JSON (skip-with-warn if absent, mirroring `db/seed/oms.ts:135-142`), and produce (a) one `properties` row (Foundry, its submarket and county, hasOffice true), (b) `units` rows for every unit (occupied units carry `tenantName` = lease name + rent; vacant units carry `tenantName = null` so they read as available-to-rent), (c) `leaseAbstracts` rows for the occupied leases with `source = "bulk_load"`, real `rawSections` (Parties, Lease Dates, Rent Schedule, Security Deposit, plus a "Lender Consent / Loan Documents" section on inherited leases for C3 q5) and the structured columns C3 reads (`leaseEnd`, `baseRentSchedule`, `securityDeposit`, etc.), and (d) the per-section rows to write into `lease_sections_fts`.

- [ ] **Step 3:** Wire into `db/seed/index.ts`: call `buildAcquisitionBulkSeed()` after `buildOmSeed()`, insert properties/units/leaseAbstracts, and write the FTS rows the same way the existing seed does (`index.ts:83-92`). Add the Foundry property/units to the wipe order if a dedicated cleanup key is needed (reuse the existing properties/units wipe).

- [ ] **Step 4:** Add the Foundry submarket entry to `db/seed/_data.ts` SUBMARKETS (with its county and zip) so the A1 geography filter and submarket aggregates accept Foundry units. Add the six `.xls` + Foundry rent roll + Harbor Park One Excel to the `db/seed/README.md` runtime-fixtures table.

- [ ] **Step 5:** `pnpm db:reset` -> seed completes including Foundry. Spot-check: `sqlite3` count of `units` where property = Foundry, and `leaseAbstracts` where `source='bulk_load'`. Re-run `pnpm test tests/api/search-comps.test.ts` to confirm A1 aggregates still pass with the new Foundry submarket present.

### Task C.3: A5 bulk-load + preview API

**Files:** Create `app/api/acquisition/bulk-load/route.ts`, `app/api/acquisition/preview/route.ts`; Test `tests/api/acquisition-bulk-load.test.ts`

- [ ] **Step 1: Write the failing test** `tests/api/acquisition-bulk-load.test.ts`: POST `/api/acquisition/bulk-load` (selecting the Foundry worked example) returns `{ data: { propertyCode, leaseCount, occupiedUnits, vacantShells, totalSf, tables: { commLeases, commUnitXrefs, commUnits, commSqfts, commChargeSchedules, commContacts } }, error: null }`, with `leaseCount` and `vacantShells` matching the authored counts, the six table arrays present, and the fan-out invariants holding. Follow the route-test mock pattern (mock `@/lib/notify`; the route does no LLM call so no anthropic mock needed). GET `/api/acquisition/preview` returns the counts.

- [ ] **Step 2: Run -> FAIL** (routes missing).

- [ ] **Step 3: Implement** `app/api/acquisition/bulk-load/route.ts`: load the Foundry `ClosingRentRoll` (from the committed JSON), run `fanOutToYardiTables`, return the six tables + counts, and (idempotently) ensure the seed-persisted rows exist. Implement `app/api/acquisition/preview/route.ts` to return counts for the summary card. Response shape `{ data, error }` per the A1 ingest convention. Fire `notify({ kind: "bulk_load_complete", ... })` (add the kind to `lib/notify.ts`).

- [ ] **Step 4:** `pnpm test tests/api/acquisition-bulk-load.test.ts` -> PASS. Commit.

### Task C.4: A5 UI (route, components, sidebar, home card)

**Files:** Create `app/acquisition-bulk-load/page.tsx`, `app/acquisition-bulk-load/process.md`, `components/a5/ClosingRentRollPanel.tsx`, `components/a5/SixTableEmitPreview.tsx`, `components/a5/BulkUploadSummary.tsx`; Modify `components/shell/Sidebar.tsx:43-48`, `components/shell/StatusGrid.tsx:10-20` (id union + DemoStatus)

- [ ] **Step 1:** Build `app/acquisition-bulk-load/page.tsx` reusing the A1 upload/toast/card pattern: a `ClosingRentRollPanel` to select the Foundry worked example (and an "upload disabled - needs Yardi access" affordance), a `BulkUploadSummary` card (X leases, Y occupied units, Z vacant shells, total SF), and a `SixTableEmitPreview` with one tab per table (CommLeases / CommUnitXrefs / CommUnits / CommSQFTs / CommChargeSchedules / CommContacts), each showing the row count and a small sample grid, visually tagging occupied fan-out vs vacant shells. No em dashes.
- [ ] **Step 2:** Add the A5 sidebar entry under Acquisitions in `Sidebar.tsx` ("A5 Acquisition Bulk-Load" -> `/acquisition-bulk-load`). Widen the `StatusGrid` DemoCard id union to include `"A5"` and add the A5 card (status BUILD PARTIAL, "needs Yardi access").
- [ ] **Step 3:** Author `app/acquisition-bulk-load/process.md` (four sections; Perspective: Acquisitions; Trigger: a deal closes and Keystone inherits the seller's in-place leases). Flag in "What the demo does NOT cover": live `.xls` ingest (needs Yardi access), and that vacant counts are illustrative (the real property is nearly fully occupied).
- [ ] **Step 4:** `pnpm build` -> clean (TS strict; the id-union widening must be complete). Manual check via `pnpm dev` at `/acquisition-bulk-load`. Commit.

### Task C.5: A5 -> C3 chain verification

- [ ] **Step 1:** After `pnpm db:reset`, curl C3 with a Foundry tenant question (e.g. "Who is responsible for HVAC at [Foundry tenant]'s lease?") and confirm a cited answer from a `bulk_load` lease. Confirm a "what is empty and rentable at Foundry?" query surfaces the vacant shells (see Stream D for the availability side-path). Document the curl + output in the task.

---

## Stream D: C3 strengthen

C3 retrieval (`lib/retrieval.ts`) + prompt (`lib/prompts/lease-intelligence.ts`) + chips (`app/lease-intelligence/page.tsx:57-73`) survive; the work is additive: 8 example questions, loan-doc handling, a structured per-property expiration schedule, and the A5 availability path.

### Task D.1: Per-property tenant expiration schedule (structured output)

**Files:** Modify `lib/retrieval.ts` (expiration side-path 298-326), `lib/prompts/lease-intelligence.ts` (extend `LeaseAnswer` with optional `schedule`), `components/c3/LeaseIntelligenceClient.tsx` (render the schedule block); Test `tests/prompts/lease-intelligence.test.ts`, `tests/lib/retrieval.test.ts`

- [ ] **Step 1: Write failing tests:** (a) `LeaseAnswer` parses with and without the new optional/nullable `schedule` field (array of `{ propertyAddress, tenant, suite, leaseEnd, daysToExpiry, renewalOption }`); make it nullable to avoid the L1 "/complete 500 on omitted nullable" class of regression (fixed in an earlier version). (b) retrieval groups expiring leases by property when the query mentions a property + expiration.
- [ ] **Step 2: Run -> FAIL.**
- [ ] **Step 3: Implement:** extend the expiration side-path to group by `propertyAddress` and emit the structured schedule; add the `schedule` field to `LeaseAnswer` (nullable/optional) and to the prompt guidance; render it as a dedicated schedule block in `LeaseIntelligenceClient`.
- [ ] **Step 4: Run -> PASS.**

### Task D.2: Loan-document / lender-consent handling

**Files:** Modify `lib/retrieval.ts` (new `mentionsLoanDocs` classifier + side-path), `db/seed/lease-abstracts.ts` and `db/seed/acquisition-bulk.ts` (add "Lender Consent / Loan Documents" rawSections on inherited leases), `lib/prompts/lease-intelligence.ts`; Test `tests/lib/retrieval.test.ts`

- [ ] **Step 1: Write failing test:** a query like "Is lender consent required for [Foundry tenant]'s lease?" returns >= 1 section whose heading matches loan/lender/consent, sourced from a `bulk_load` lease's real `rawSections` (so the citation is clickable, not a synthetic page-0 section). Reuse the A3 "Approve Loan Docs / Debt Compliance" vocabulary.
- [ ] **Step 2: Run -> FAIL.**
- [ ] **Step 3: Implement** the classifier + side-path (regex anchored so it does not collide with the NER `ti allowance` / expiration regexes) and seed the loan-doc sections on the A5 inherited leases. Keep these as real `rawSections` entries so the section-expansion route resolves them.
- [ ] **Step 4: Run -> PASS.**

### Task D.3: Availability ("what is empty and rentable") via A5 shells

**Files:** Modify `lib/retrieval.ts` (new units-aware availability path) or add a dedicated query branch; Test `tests/lib/retrieval.test.ts`

- [ ] **Step 1: Write failing test:** a query mentioning availability/empty/rentable for Foundry returns the vacant `units` rows (tenantName null) as result items C3 can cite.
- [ ] **Step 2: Run -> FAIL.**
- [ ] **Step 3: Implement** a units-aware side-path that, on availability intent, queries vacant units (`isNull(units.tenantName)`) joined to properties and injects them as answer context. Keep the result shape distinct from lease sections so the citation list does not mix shapes confusingly.
- [ ] **Step 4: Run -> PASS.**

### Task D.4: Wire the 8 example questions + chips

**Files:** Modify `app/lease-intelligence/page.tsx:57-73` (portfolio chip set), `tests/api/lease-intelligence.test.ts`

- [ ] **Step 1:** Replace the 6 portfolio chips with the 8 from Decision D6 (keep wording em-dash-free): HVAC responsibility for `${firstTenant}`; per-property tenant expiration schedule for Foundry; leases expiring next quarter; compare net effective rents across the negotiated leases; lender consent / loan docs for `${firstTenant}`; renewal options summary across the portfolio; which leases have free rent in year 1; which leases have TI allowance over $10 per square foot.
- [ ] **Step 2:** Add a route test (`lease-intelligence.test.ts`) asserting the structured-schedule branch returns a parsed `schedule` and the loan-doc branch returns a citation. Mock anthropic per the existing canned pattern.
- [ ] **Step 3:** `pnpm test tests/lib tests/prompts tests/api/lease-intelligence.test.ts` -> PASS. Commit.

### Task D.5: C3 docs (prereq now BOTH L2 and A5)

**Files:** Modify `app/lease-intelligence/process.md`, `solution_builds.md` (C3 section L1007-1119; reconcile the stale "four canonical queries" at L1095/L1132 to the new 8; update L362-364 build-order note to "depends on BOTH L2 and A5"), `docs/process/current-vs-demo-mapping.md:73-85`, `CLAUDE.md:304-326`

- [ ] **Step 1:** Update all three current-vs-demo surfaces + CLAUDE.md C3 one-pager: prereq = L2 (leased corpus) AND A5 (vacant shells + bulk-loaded leases); add loan-docs + per-property schedule + availability; label the 8 questions as FlexOps AI-curated example prompts grounded in Jordan's use cases. Commit.

---

## Stream E: L1 reframe to form-backend qualification

Strip the conversational front-end (ChatWidget, KeystoneMockSite, streaming route, chat system prompt). Keep the qualification engine (`lib/prompts/extract-lead.ts` schema + fit profile + rubric). Add a structured form, a synchronous form-submission endpoint, match-to-available-units (new), and an enriched lead to the inbox. The leads table, GET/PATCH `/api/leads`, and LeadInbox survive.

### Task E.1: Match-to-available-units (new, deterministic)

**Files:** Create `lib/match-units.ts`; Test `tests/lib/match-units.test.ts`

- [ ] **Step 1: Write failing test:** `matchUnits({ sqft, submarket, leaseType }, vacantUnits)` returns ranked matches preferring same submarket and nearest size band, degrading gracefully (returns `[]` cleanly when no vacant unit fits). Vacant seeded units have `rentPerSqft = null`, so the matcher must not depend on rent.
- [ ] **Step 2: Run -> FAIL.**
- [ ] **Step 3: Implement** `matchUnits` using sqft band proximity + submarket match (+ optional leaseType), reusing the `AvailableUnit` shape from `lib/prompts/leasing-chat.ts:1-8` (which survives the chat-prompt retirement).
- [ ] **Step 4: Run -> PASS.**

### Task E.2: Form-submission endpoint (reuse the qualification engine)

**Files:** Modify `app/api/leads/route.ts` (add POST), `lib/prompts/extract-lead.ts` (add a structured-input variant), retire `app/api/chat/leasing/complete/route.ts`; Rewrite `tests/api/leasing-complete.test.ts` -> `tests/api/leads-form.test.ts`

- [ ] **Step 1: Write failing test** `tests/api/leads-form.test.ts`: POST `/api/leads` with `{ location, spaceSizeSqft, businessType, businessName, additionalCriteria }` (mock anthropic to return a canned verdict+confidence+reasoning+tierMap) inserts a `leads` row with `source = "form"`, computes matched units, attaches them to the emitted lead, and fires `notify({ kind: "qualified_lead" })`. Clean up by `source = "form"`.
- [ ] **Step 2: Run -> FAIL.**
- [ ] **Step 3: Implement:** add a POST handler to `/api/leads` that serializes the form fields into a `buildFormQualificationPrompt` variant of `extractLeadPrompt` (keep the fit profile lines 74-78 and rubric 80-85 verbatim), runs the same LLM->parse->validate, calls `matchUnits`, persists the lead (store matched units on a JSON column or in the existing free-text payload; if a column is cleaner, add `leads.matchedUnits` via a hand-written migration `0008_l1_form_matches.sql` following the 0002+ pattern), and notifies. Retire `/api/chat/leasing/complete` and the streaming `/api/chat/leasing` route.
- [ ] **Step 4: Run -> PASS.**

### Task E.3: Form UI + inbox detail; retire chat front-end

**Files:** Create `components/l1/QualificationForm.tsx`; Modify `components/l1/ChatLeasingTabs.tsx` (drop site tab, swap copy), `components/l1/LeadInbox.tsx` (replace transcript drawer with a form-criteria + matched-units panel), `app/chat-leasing/page.tsx` (drop featured-properties fetch for the mock site); Delete `components/l1/ChatWidget.tsx`, `components/l1/KeystoneMockSite.tsx`, `lib/prompts/leasing-chat.ts` system prompt (keep `AvailableUnit` + `formatAvailability`)

- [ ] **Step 1:** Build `QualificationForm` (five fields) submitting to POST `/api/leads`, reusing the react-query invalidation + sonner toast pattern. Replace the chat widget in the L1 tab; keep the Leasing Team Inbox tab.
- [ ] **Step 2:** In `LeadInbox`, replace the transcript drawer (`parseTranscript`, 129-147 + 367-395) with a structured submission view + a matched-units panel. Keep verdict badge, reasoning, EDIT_FIELDS, schedule/callback, GET/PATCH wiring.
- [ ] **Step 3:** Delete `ChatWidget`, `KeystoneMockSite`, and the conversational `leasingChatSystemPrompt`; retire the streaming route together with it. Rewrite/trim `tests/prompts/leasing-chat.test.ts` (keep `formatAvailability` tests, drop the conversational-prompt assertions) and `tests/prompts/extract-lead.test.ts` (adapt the transcript-embed assertion to the form-input variant; schema tests survive).
- [ ] **Step 4:** Optionally seed a few form leads (with matched units) so the inbox is non-empty for the demo (leads are never seeded today). `pnpm build` -> clean. `pnpm test tests/api/leads-form.test.ts tests/prompts/leasing-chat.test.ts tests/prompts/extract-lead.test.ts` -> PASS. Commit.

### Task E.4: L1 docs

**Files:** Modify `app/chat-leasing/process.md`, `solution_builds.md` (L1 section L714-862, mark Tier 2), `docs/process/current-vs-demo-mapping.md:41-53`, `CLAUDE.md:232-258`

- [ ] **Step 1:** Re-tag all three current-vs-demo surfaces: chat UI = replaces, qualification engine = augments, unit-match = new; mark L1 Tier 2 ("we heard you" reframe). Commit.

---

## Stream F: A3 reframe to visibility-only

Strip auto-comms (auto-task notifications, RFP drafting, lender packet, inbox monitoring, blocker-action chase loop). Keep the read-only consolidated cross-deal dashboard (ChecklistPanel + the overdue rollup) and the manual status PATCH. Add a closing milestone that hands the property to A5.

### Task F.1: Remove auto-comms routes, components, and prompts

**Files:** Delete `components/a3/{LenderPacketPanel,RFPDraftTabs,InboxMonitoringPanel,PerTaskNotifications}.tsx`; delete `app/api/onboarding/{draft-rfp/route.ts, rfp-drafts/[id]/route.ts, lender-packet/route.ts, inbox/route.ts, inbox/simulate/route.ts, task-notifications/route.ts, blocker-action/route.ts}`; delete `lib/prompts/{draft-rfp,lender-packet}.ts` and `tests/prompts/draft-rfp.test.ts`; Modify `app/onboarding/page.tsx:7-16,31-34,86-97` (drop imports + render), `app/api/onboarding/extract-psa/route.ts:112-135` (strip per-task notifications + deposit_due notify, keep extraction + `buildTasksForDeal`)

- [ ] **Step 1:** Remove the four components from the page composition and delete them; drop the `loanTask` derivation. Delete the seven auto-comms API routes and the two prompt modules + the draft-rfp test.
- [ ] **Step 2:** Strip `extract-psa/route.ts:112-125` (per-task `task_created` notifications) and `128-135` (deposit_due notify); keep `22-110`. Prune now-unused `NotifyKind` values (`rfp_ready`, `coi_received`, `lender_packet_ready`, `task_created`) from `lib/notify.ts` but keep the file (L1 uses it).
- [ ] **Step 3:** `pnpm build` -> clean (no dangling imports). `pnpm test` -> the draft-rfp cases are gone; confirm `onboarding-extract-psa.test.ts` still passes after confirming the post-strip task composition (do NOT blindly edit its category-count assertions; verify first).

### Task F.2: Blocker Center -> visibility-only

**Files:** Modify `components/a3/BlockerCenter.tsx` (drop runAction 89-116, action buttons 221-264, dialogs 271-321, recommended-chase copy 208-210), `app/api/onboarding/blockers/route.ts` (drop chase/escalate enrichment 32-70, keep raw aggregation 10-30)

- [ ] **Step 1:** Reduce BlockerCenter to the overdue-across-deals list (property, task, team, due date, days-overdue) with no actions. Keep the kept seeded blocker (Coastal `avid_setup`, `deals.ts:437-442`) so the page is not empty. `pnpm build` -> clean.

### Task F.3: Closing milestone -> A5 handoff

**Files:** Modify `components/a3/DealTimeline.tsx:54-60` (add a 5th node "Bulk-load to Yardi (A5)"), `app/onboarding/page.tsx` (render a handoff card on `closing`/`closed` deals linking to `/acquisition-bulk-load`)

- [ ] **Step 1:** Add the 5th timeline node and a handoff card keyed off `deals.status` in `("closing","closed")` (Linwood closed + Coastal closing are already seeded). No new schema. `pnpm build` -> clean.
- [ ] **Step 2:** Remove the orphaned `rfpDrafts` (deals.ts:551-608) and `inboxEvents` (deals.ts:652-689) seed blocks; trim the now-empty `drafts` join from `deals/route.ts` and the `DealBundle.drafts` type. `pnpm db:reset` -> clean seed. Commit.

### Task F.4: A3 docs

**Files:** Modify `app/onboarding/process.md`, `solution_builds.md` (A3 section L568-712, mark Tier 2), `docs/process/current-vs-demo-mapping.md:25-37`, `CLAUDE.md:207-230`

- [ ] **Step 1:** Re-tag all three current-vs-demo surfaces: auto-comms = replaces, dashboard = augments, closing handoff = new; mark A3 Tier 2 ("we heard you" reframe). Commit.

---

## Stream G: Tiering presentation

### Task G.1: Group the home grid into Tier 1 / Tier 2

**Files:** Modify `components/shell/StatusGrid.tsx`

- [ ] **Step 1:** Group cards under two headings: "Tier 1 - Validated headliners" (A1, C3, L2, A5) and "Tier 2 - We heard you (reframed)" (L1, A3). Add a short "we heard you" line on the Tier 2 cards explaining each reframe answers the objection that killed it. No em dashes. `pnpm build` -> clean. Commit.

---

## Stream H: Cross-cutting docs

### Task H.1: CLAUDE.md vocabulary, A5 one-pager, L3 retirement, A1 rents

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1:** Widen the master-ID rule (L399) to `A1-A5`. Insert a "### **Demo A5: Acquisition Lease Bulk-Load** (BUILD PARTIAL)" one-pager after the L2 one-pager (before C3 at L304) using Perspective (Acquisitions) + Trigger. Rewrite the Phase-2 L3 line (L330) to "retired as a standalone item; UI path absorbed by L2, bulk path by A5; 5+ hrs/week pain kept as justification". Update the Mock Data Strategy rents block so built-out MG Marisol units read $27-30/sqft anchored on Harbor Park One. Reframe the L1 and A3 one-pagers (already partly covered in Streams E/F docs tasks; ensure CLAUDE.md agrees). Commit.

### Task H.2: solution_builds.md A5 section + reframes + retired-L3 note

**Files:** Modify `solution_builds.md`

- [ ] **Step 1:** Insert a full "### **Demo A5**" section between the L2 section end (L1005) and the C3 header (L1007), standard template + inline Current-vs-Demo dup. Add a short retired-L3 note at the end of the L2 section. Ensure the L1/A3/L2/C3/A1 sections match their Stream docs edits. Update the route-comment table (L116-122): add the A5 route, retire the standalone L3. Commit.

### Task H.3: Solution Summary table (canonical) + README

**Files:** Modify the master synthesis Solution Summary table (kept outside the repo), `README.md`

- [ ] **Step 1:** In the Master Solution Summary table: add a `Tier` column; add an A5 row (`A5 | Acquisition Lease Bulk-Load | Acquisitions | Demo (needs Yardi access) | High | Tier 1 | ...`); mark L1 and A3 Tier 2 / reframed; mark L3 row 183 Retired (Demo? = "Retired", rationale keeps the 5+ hrs/week pain point) and **scrub any individual names**. Leave A2 unchanged. Add an A5 row + L1/A3/L3 status to the README active-demos table; add an A5 process.md pointer. Commit.

### Task H.4: Cross-demo index, checklist, file-layout, session log

**Files:** Modify `docs/process/current-vs-demo-mapping.md` (add A5 section after L2; note L3 absorbed at L93/L99), the end-of-session checklist (expand the process.md currency list to A1, A3, L1, L2, C3, A5), `docs/reference/file-layout-deep.md` (add A5 route + Foundry/six-.xls citation-source rows), the session log (append ONE new top entry; report the new test count; do not rewrite history)

- [ ] **Step 1:** Make all four edits. Commit.

---

## Stream I: Verification and reporting

### Task I.1: Full suite + build + lint to green

- [ ] **Step 1:** `pnpm db:reset && pnpm test 2>&1 | tail -25` -> all pass. Record the exact new test count.
- [ ] **Step 2:** `pnpm build 2>&1 | tail -15` -> clean across all routes (now including `/acquisition-bulk-load`).
- [ ] **Step 3:** `pnpm lint` -> clean.
- [ ] **Step 4:** Grep for em dashes introduced this session: `grep -rn "—" app components lib db/seed *.md docs 2>/dev/null` -> none in new/edited lines.

### Task I.2: Cross-demo walkthrough (curl)

- [ ] **Step 1:** With `pnpm dev` running: (a) POST `/api/acquisition/bulk-load` -> six tables + counts; (b) C3 query a Foundry tenant -> cited `bulk_load` answer; (c) C3 "what is empty and rentable at Foundry" -> vacant shells; (d) POST `/api/leads` form -> verdict + matched units in the inbox; (e) `/onboarding` closed deal -> A5 handoff card. Capture outputs.

### Task I.3: Report

- [ ] **Step 1:** Update the session log and the Solution Summary / README with the final test count (was 97/97). Summarize: A5 added (Tier 1), L1 + A3 reframed (Tier 2), L3 retired, A1/C3 strengthened, L2 narrowed, A2 unchanged on the bench.

---

## Self-Review (run before execution handoff)

- **Spec coverage:** item 1 (L2/A5 split + L3 retire) = Streams B, C, H; item 2 (L1 reframe) = Stream E; item 3 (A3 reframe) = Stream F; item 4 (C3 + A1) = Streams D, A; item 5 (tiering) = Streams G, H.3; item 6 (docs + tests) = Streams H, I. All covered.
- **Placeholders:** the novel code (fan-out, match-units, schedule/loan-doc/availability paths, rent recalibration) carries real test code + implementation sketches; mechanical reframes carry exact file:line targets. Executors must still write full implementations following the cited patterns.
- **Type consistency:** `fanOutToYardiTables` / `YardiEtlTables` / `ClosingRentRoll` used consistently across C.1/C.2/C.3; `leaseAbstracts.source = "bulk_load"` used in C.2/E.2/D.2; `matchUnits` signature consistent across E.1/E.2.
- **Migrations:** only L1's optional `matchedUnits` column (E.2) may need a hand-written `0008`; A5 needs none (D1). If `matchedUnits` is stored as JSON on an existing free-text path, even that is avoidable.
