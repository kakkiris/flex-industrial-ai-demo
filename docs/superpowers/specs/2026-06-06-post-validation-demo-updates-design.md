# Post-validation demo updates (design)

**Date:** 2026-06-06
**Author:** the consultant + Claude
**Branch / worktree:** `feat/post-validation-updates` at `.worktrees/post-validation`
**Restore point:** tag `known-good/pre-validation-feedback-2026-06-06` (on main)
**Source feedback:** 4-Jun the consulting team demo + validation session (meeting notes kept outside this repo).

---

## 1. Goal

Apply the 4-Jun validation feedback to the demo suite ahead of the final presentation. Five code workstreams (WS-A through WS-E) are covered by this spec. Three new solution tracks (Portfolio Absorption, Historical Operating Performance, Website to Yardi vacancy sync) are non-code scoping work and are handled in a separate deliverable, not here.

## 2. Decisions locked with the consultant

- **A3:** delete from the demo entirely; record as "considered, declined" in the report. (Not a reframe.)
- **L1 chat:** keep both versions; reframe the copy from "declined" to "warmed-to, pending cost vs. traffic." No logic change.
- **L2 OpEx:** extract the **stated lease terms** (type, base year, method, share, categories). Do not model reconciliation math (no budget/expense data in the lease).
- **A1 sensitivity:** axes are **purchase price (rows) x stabilized rent per sqft (cols)**; cells are yield-on-cost; cost-to-stabilize shown as a sub-line. Badged "first pass."
- **Home grid:** flat list of 5 demos (drop the Tier 1 / Tier 2 "we heard you" split).

## 3. Out of scope for this spec

- A1 full underwriting redesign (Alex is sending a written spec; a 2nd underwriting model and ground-up development models are not yet provided). We ship a first pass and refine later.
- C3 role-based tiered display (a dev-config decision per the call; note as roadmap, do not build).
- L2 OpEx reconciliation math against budgets (portfolio / C3 follow-up).
- The three new solution tracks (separate scoping doc).
- Live Yardi API, real loan-doc parsing, production form integration (unchanged pre-existing follow-ups).

---

## 4. WS-A: Remove A3 (Onboarding) entirely

**What A3 is today:** `/onboarding` and `/onboarding/blockers` routes with a proposal/reframed toggle; `components/a3/*` (14 components); `app/api/onboarding/*` (12 routes); prompts `extract-psa.ts`, `draft-rfp.ts`, `lender-packet.ts`; seed `deals.ts`, `_a3-template.ts`; schema tables `deals`, `onboardingTasks` (a.k.a. onboarding_tasks), `rfpDrafts`, `inboxEvents`; `notifications` columns `taskId` / `team` / `event`; sidebar entries (A3 + A3 Blocker Center); home-grid A3 card; A5 deal-timeline inbound handoff link; A3 test files.

**Deletions:**
- Routes: `app/onboarding/` (page + blockers), and the directory.
- Components: all of `components/a3/`.
- API: all of `app/api/onboarding/`.
- Prompts: `lib/prompts/extract-psa.ts`, `lib/prompts/draft-rfp.ts`, `lib/prompts/lender-packet.ts`.
- Seed: `db/seed/deals.ts`, `db/seed/_a3-template.ts`; remove their wiring from `db/seed/index.ts`.
- Tests: `tests/api/onboarding-extract-psa.test.ts`, `tests/prompts/extract-psa.test.ts`, `tests/prompts/draft-rfp.test.ts`, and any other A3-only suites surfaced during implementation.

**Schema / migration:** add a new migration `00XX_remove_a3.sql` that drops `deals`, `onboarding_tasks`, `rfp_drafts`, `inbox_events`, and the A3-only `notifications` columns (`task_id`, `team`, `event`) if they are not used elsewhere. Update `db/schema.ts` to match. Keep the `notifications` table itself (L1 / L2 / A5 use it). Confirm no FK from a surviving table points at a dropped table before dropping.

**Ripple handling:**
- **A5:** remove the A3 handoff link only on the A3 side (already deleted). A5 itself does not import A3; verify `components/a5/*` and the A5 route have no A3 references.
- **notify.ts:** drop A3-only `NotifyKind` values (`task_overdue`, `rfp_ready`, `coi_received`) if unreferenced after deletion; keep `qualified_lead`, `extraction_complete`, `bulk_load_complete`.
- **Sidebar (`components/shell/Sidebar.tsx`):** remove the A3 and "A3 Blocker Center" nav entries; the Acquisitions track keeps A1 and A5.
- **Home grid (`components/shell/StatusGrid.tsx`):** see WS-A2 below.
- **lib/version.ts / VersionToggle / VersionBanner:** still needed by L1 (WS-B). Do not delete.

**WS-A2: Home grid flat list of 5.** Rewrite `StatusGrid.tsx` to drop the `tier` grouping and the "we heard you" headings; render one grid of five cards (A1, C3, L2, A5, L1) in a sensible order (Tier 1 headliners first: A1, C3, L2, A5; then L1). Remove the A3 `DemoCard`. L1 keeps its `versionTag: "Two versions"` chip but the `reframeNote` is updated by WS-B. Fix the home hero copy in `app/page.tsx` ("Five proof-of-concept demos" is now correct; ensure both paragraphs say five and no longer imply six or reference A3).

**Report:** A3 logged in the scoping/report deliverable as declined, with Jordan's reasoning (deal process is human-owned and unpredictable; checklist is an aid not a driver; financing = a separate team, iterative and relationship-driven; DD RFPs = local handshake vendors, ~15/yr, copy-paste is trivial).

**Acceptance:** no `/onboarding*` routes; no `components/a3`, `app/api/onboarding`, A3 prompts/seed; `pnpm db:reset` seeds with no A3 tables; sidebar and home show five demos; `pnpm build` + `pnpm test` clean; grep for `onboarding`, `a3`, `lender-packet`, `draft-rfp`, `extract-psa`, `deals`, `onboardingTasks`, `rfpDrafts`, `inboxEvents` returns no live references.

---

## 5. WS-B: L1 chat reframe (copy only)

**Problem:** `components/shared/VersionBanner.tsx` proposal-mode copy says the chat was "declined on 29-May feedback." Jordan reversed on 4-Jun (he liked the chat more than expected and saw a practical use for it), gated on cost vs. website traffic; Taylor noted multi-channel deployability (email signature, referral intake).

**Change:**
- Parameterize `VersionBanner` so the banner text is passed in per demo (it is now L1-only since A3 is gone). Props: `proposalText`, `reframedText` (or a small `copy` object), with sensible defaults preserved.
- L1 (`app/chat-leasing/page.tsx`) passes:
  - proposal banner: "Original proposal: a conversational qualification chatbot. Jordan warmed to it on the 4-Jun demo and sees practical use; viability depends on cost vs. website traffic. Deployable beyond the site (email signature, referral intake)."
  - reframed banner: keep the current "reframed structured-form backend" framing (form is the default shipped path).
- Update the L1 home-grid `reframeNote` (in `StatusGrid.tsx`) to reflect "chat now a live option pending cost vs. traffic; both the structured form and the chat are available," replacing "Conversational chatbot was declined."

**No logic change.** Both `ChatProposalView` (chat) and `ChatLeasingTabs` (form) stay; the `?v=` toggle stays.

**Acceptance:** `/chat-leasing` (form) and `/chat-leasing?v=proposal` (chat) both render; banners read the new copy; no "declined" wording remains for L1; tests still pass (add/adjust a banner copy assertion if one exists).

---

## 6. WS-C: L2 operating-expense recovery extraction

**Why:** Alex's headline L2 gap. Alex singled out OpEx recoveries as one of the most important things to get right, and bill correctly, in Yardi. Pass-throughs vary by lease (legacy, form, negotiated form). Decision: extract the stated lease terms only.

**Schema (`lib/prompts/extract-lease.ts`, `LeaseAbstract` zod):** add a structured `operatingExpenseRecovery` object (nullable, since some leases are silent):
```
operatingExpenseRecovery: {
  recoveryType: enum("nnn_full", "base_year_stop", "modified_gross", "gross_none", "custom") | null
  baseYear: number | null               // e.g. 2024; null for NNN/gross
  recoveryMethod: enum("pro_rata_share", "fixed", "custom") | null
  proRataSharePct: number | null        // tenant's % of building expenses
  expenseCategories: string[]           // e.g. ["taxes","insurance","cam","management"]
  capPct: number | null                 // annual cap on controllable expenses, if stated
  reconciliationBasis: enum("calendar_year","lease_year") | null
  notes: string | null                  // verbatim or summarized recovery clause
}
```
Add a per-field confidence entry (reuse the existing per-field confidence mechanism). Prompt: instruct the model to read the Additional Rent / Operating Expenses / CAM / Taxes / Insurance clauses; never invent; mark uncertain fields low confidence.

**rawSections:** ensure the recovery clause(s) (Operating Expenses, Additional Rent, CAM, Real Estate Taxes, Insurance) are captured in `rawSections` so C3 can cite them. This is the link that makes Alex's live question ("what is the OpEx recovery for this lease?") answerable.

**DB:** `leaseAbstracts` already has `camTerms` and `estimatedRecoveryPsf`. Add an `operatingExpenseRecovery` JSON column via a migration; keep `estimatedRecoveryPsf` (the EstUtil $/sqft hint used by the Yardi modal). Update `db/schema.ts`.

**UI (`components/l2/AbstractEditor.tsx`):** new "Recoveries" field group rendering `recoveryType`, `baseYear`, `recoveryMethod` + `proRataSharePct`, `expenseCategories`, `capPct`, `reconciliationBasis`. Low/medium-confidence fields fall into the existing "Needs review" group. Inline edits commit on blur via the existing PUT path.

**Yardi modal (`components/l2/PushToYardiModal.tsx`):** extend the recovery presentation. Today it emits an EstUtil line (stated `estimatedRecoveryPsf` or ~9% fallback). Add the recovery setup context (type + base year + method + share) alongside EstUtil so the leasing team sees how the recovery is billed, not just a $/sqft number. Keep NNN suppressing EstUtil where appropriate.

**Seed (`db/seed/lease-abstracts.ts`):** populate `operatingExpenseRecovery` on the seeded abstracts to exercise the field: at least one NNN full pass-through, one base-year-stop (with base year + cap), one gross/none. Add a recovery rawSection to those leases so C3 returns a citation.

**C3 (light):** add a recovery intent so a query like "operating expense recovery for X" reliably surfaces the recovery rawSection. Either extend the existing classifiers in `lib/retrieval.ts` with a `mentionsRecovery` side-path (pulls the recovery rawSections for the named/all leases) or rely on FTS if the section text is strong. Decide during implementation; minimum bar is that the Alex question returns a cited answer.

**Acceptance:** uploading/seeding a lease yields a populated `operatingExpenseRecovery` with confidence; AbstractEditor shows the Recoveries group and flags low-confidence ones; PushToYardiModal shows recovery setup + EstUtil; C3 answers "what is the OpEx recovery for [tenant]?" with a citation to the recovery section; new + existing tests pass; add a unit test for the new schema parse and a C3 retrieval test for the recovery path.

---

## 7. WS-D: C3 richer default outputs + NOI-lift

**Why:** Alex wants more on first look. Unit size and rent per sqft should appear automatically next to dates; he wants an anticipated NOI lift derived from the expiration schedule; and a fuller default response so terse queries still return headline rental items.

**Schedule rows (`lib/prompts/lease-intelligence.ts`, `ScheduleRow`):** add `sizeSqft: number | null` and `rentPerSqft: number | null` so every per-property expiration / schedule answer carries size and rent per sqft beside the dates. Render them in the schedule block in `components/c3/LeaseIntelligenceClient.tsx` (extra columns: Size, Rent/SF).

**Data plumbing:** the per-property expiration path in `lib/retrieval.ts` must source `sizeSqft` and in-place `rentPerSqft` per lease.
- Bulk-load (A5 / Foundry) leases: join the `units` rows (they carry `sizeSqft`; rent/sqft from the lease's `baseRentSchedule[0].annualRentPerSqft` or the unit rent).
- L2 negotiated leases: size from the linked unit if present, else from the abstract; rent/sqft from `baseRentSchedule`. Where unavailable, emit null and render "-".

**NOI-lift layer:** on per-property expiration queries, compute an anticipated NOI lift summary:
```
noiLift = sum over leases expiring in the window of
          max(0, marketRentPsf(submarket) - inPlaceRentPsf) * sizeSqft
```
`marketRentPsf` comes from `lib/uw-assumptions.ts` (`getUwAssumptions` for the property's submarket; reuse the same engine A1 uses, so A1 and C3 agree). Render as a headline stat above the schedule (e.g., "Anticipated NOI lift at rollover: ~$NN,NNN/yr across N expiring leases"). Add an optional `analysis` field to `LeaseAnswer` (e.g., `analysis: { noiLiftAnnual: number, expiringCount: number, basis: string } | null`) so the client can render it as a typed stat rather than free text. Keep it as a clearly-labeled estimate (uses market-rent assumptions, not signed comps).

**Robust default response:** strengthen the system prompt so terse queries (e.g., just a property name) return the headline rental items (tenant, suite, size, rent/sqft, lease end, renewal) by default, citing sources, instead of asking the user to be more specific.

**Role-tiered display:** roadmap note only; do not build.

**Acceptance:** per-property expiration answers show Size and Rent/SF columns automatically; an NOI-lift stat renders for expiration queries on a property with below-market in-place rents; a terse query returns headline items; citations still resolve; add tests for the `ScheduleRow` size/rent fields, the NOI-lift computation (pure function, deterministic), and the prompt schema.

---

## 8. WS-E: A1 yield-on-cost x purchase-price sensitivity table (first pass)

**Why:** Alex's primary desired A1 output: a sensitivity table of yield-on-cost against purchase price. Plus the cost to achieve stabilized rent and the rent-per-sqft assumptions.

**Engine (`lib/uw.ts`):** add a pure function, e.g.
```
sensitivityMatrix(input: {
  basePurchasePrice: number,          // asking / current basis * SF, or property acquisitionPrice
  baseStabilizedRentPsf: number,      // submarket market rent midpoint (assumption)
  totalSf: number,
  assumptions: UwAssumptions,         // vacancy, noiMargin, rentGrowth, acqCostPct, reserves, capexToDemisePsf
  priceSteps?: number[],              // default [-0.07, 0, +0.07] of base price
  rentSteps?: number[],              // default market low / mid / high (from assumptions band)
}): {
  rows: { purchasePrice: number, label: string }[],
  cols: { stabilizedRentPsf: number, label: string }[],
  cells: { yieldOnCostPct: number, tone: "good"|"mid"|"low" }[][],
  costToStabilize: number,            // capexToDemisePsf * demisableSf (+ reserves)
  targetYoCPct: number,               // for cell tone thresholds
  assumptionsUsed: {...}
}
```
For each (price, rent) cell: `stabilizedNOI = rentPsf * totalSf * (1 - vacancy) * noiMargin * (1 + rentGrowth)`; `allInCost = price + acqCosts + capexToStabilize + reserves`; `yieldOnCost = stabilizedNOI / allInCost`. Reuse the existing `underwriteProperty` math so the diagonal/base cell matches today's headline number. Cell tone: `>= target` good (emerald), within ~1pt amber, below rose. `costToStabilize = capexToDemisePsf * totalSf` (plus reserves), shown as a sub-line.

**API (`app/api/properties/[id]/units/route.ts`):** compute the matrix at read time from the property's submarket assumptions (or `FOUNDRY_UW` for Foundry) and return it alongside the existing property underwriting block. No new DB columns.

**UI (`components/a1/CompDetailPanel.tsx`):** make the sensitivity grid the headline of the Property Underwriting section (price rows x rent/sqft cols, color-coded cells, target line, cost-to-stabilize sub-line, assumptions footnote). Keep the existing unit-level UW comparison below it. Badge the whole block "first pass: pending Alex's written spec, 2nd underwriting model, and ground-up development models."

**Acceptance:** selecting a property (esp. Foundry) shows a YoC sensitivity grid (price x rent/sqft) with the base cell matching the existing going-in/YoC figure, cost-to-stabilize, and the first-pass badge; matrix function is unit-tested (deterministic, matches `underwriteProperty` at the base cell); build + tests clean.

---

## 9. Cross-cutting

- **No em dashes** anywhere (repo convention). Commas / semicolons / periods only.
- **Naming:** only Jordan, Alex, Victor, Sam may appear in client-facing surfaces; team labels otherwise.
- **Docs sync (WS-I, after code):** `CLAUDE.md`, `solution_builds.md`, the session log, per-demo `process.md`, `README.md`, synthesis docs. Run the end-of-session checklist.
- **Validation per workstream:** `pnpm test`, `pnpm build`, `pnpm db:reset` clean; manual smoke of the affected route in the worktree dev server.

## 10. Risks

- **A3 deletion FK / migration:** dropping tables must respect FKs and the seed wipe order; verify nothing surviving references the dropped tables. Mitigated by the restore tag and worktree isolation.
- **C3 NOI-lift / size+rent plumbing:** the join from lease abstract to unit size + in-place rent is the trickiest piece; where data is missing, render "-" and exclude from NOI-lift rather than guess.
- **A1 first-pass vs Alex's spec:** ship behind the "first pass" badge; expect rework when his written description and the extra UW models arrive.
- **Test drift:** removing A3 deletes ~3 suites; new tests added for OpEx schema, C3 schedule fields + NOI-lift, and the sensitivity matrix should keep coverage healthy.

## 11. Sequencing

1. WS-A (remove A3) first: gives a clean base and a smaller surface. Migration + seed + grep-clean.
2. WS-B (L1 copy): quick, independent.
3. WS-C (L2 OpEx): schema + prompt + UI + seed + C3 hook.
4. WS-D (C3 defaults + NOI-lift): depends on uw-assumptions; pairs with C3 work from WS-C.
5. WS-E (A1 sensitivity): engine + API + panel.
6. WS-I (docs sync) last, then the end-of-session checklist.
