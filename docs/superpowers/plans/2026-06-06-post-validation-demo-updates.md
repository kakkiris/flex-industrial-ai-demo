# Post-validation demo updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 4-Jun FlexOps AI validation feedback to the demo suite: remove A3 entirely, reframe L1's chat copy, add L2 operating-expense recovery extraction, enrich C3 default outputs with size/rent + an NOI-lift layer, and add the A1 yield-on-cost x stabilized-rent sensitivity table.

**Architecture:** Single Next.js 16 app, Drizzle + SQLite (schema-driven migrations via `pnpm db:generate`), Anthropic SDK, zod-validated LLM output. All work on branch `feat/post-validation-updates` in `.worktrees/post-validation`. Restore point: tag `known-good/pre-validation-feedback-2026-06-06`.

**Tech Stack:** TypeScript strict, Next App Router, Drizzle ORM, better-sqlite3, vitest, zod, shadcn/ui, IBM Plex Sans/Mono.

**Spec:** `docs/superpowers/specs/2026-06-06-post-validation-demo-updates-design.md`.

**Conventions:** No em dashes anywhere. Only Jordan/Alex/Victor/Sam named in client-facing surfaces. Commit messages end with:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```
All commands run from `<local-path>` (referred to below as the app dir; `pnpm --dir <appdir> <script>` also works). Baseline before any change: 28 test files, 153 tests passing.

---

## File map (what each task touches)

- **WS-A remove A3:** delete `app/onboarding/`, `components/a3/`, `app/api/onboarding/`, `lib/prompts/{extract-psa,draft-rfp,lender-packet}.ts`, `db/seed/{deals,_a3-template}.ts`, A3 test files; edit `db/schema.ts`, `lib/notify.ts`, `db/seed/index.ts`, `components/shell/Sidebar.tsx`, `components/shell/StatusGrid.tsx`, `app/page.tsx`; regenerate migration.
- **WS-B L1 copy:** `components/shared/VersionBanner.tsx`, `app/chat-leasing/page.tsx`, `components/shell/StatusGrid.tsx`.
- **WS-C L2 OpEx:** `lib/prompts/extract-lease.ts`, `db/schema.ts`, `db/seed/lease-abstracts.ts`, `components/l2/AbstractEditor.tsx`, `components/l2/PushToYardiModal.tsx`, `lib/retrieval.ts`; tests under `tests/prompts/` + `tests/lib/`.
- **WS-D C3 defaults + NOI-lift:** `lib/prompts/lease-intelligence.ts`, `lib/uw.ts`, `lib/retrieval.ts`, `app/api/lease/intelligence/route.ts`, `components/c3/LeaseIntelligenceClient.tsx`; tests under `tests/prompts/` + `tests/lib/`.
- **WS-E A1 sensitivity:** `lib/uw.ts`, `app/api/properties/[id]/units/route.ts`, `components/a1/CompDetailPanel.tsx`; test `tests/lib/uw-sensitivity.test.ts`.
- **WS-I docs:** `CLAUDE.md`, `solution_builds.md`, the session log, `README.md`, per-demo `process.md`, synthesis docs.

---

# WS-A: Remove A3 entirely

A3 has no TDD surface (it is deletion); the gate is a clean build + green tests + a grep that finds no live A3 references. Do all edits, then verify, then commit once.

### Task A1: Delete A3 source, routes, prompts, seed, tests

**Files (delete):**
- `app/onboarding/` (entire directory: `page.tsx`, `process.md`, `blockers/page.tsx`)
- `components/a3/` (entire directory)
- `app/api/onboarding/` (entire directory)
- `lib/prompts/extract-psa.ts`, `lib/prompts/draft-rfp.ts`, `lib/prompts/lender-packet.ts`
- `db/seed/deals.ts`, `db/seed/_a3-template.ts`
- Test files: `tests/api/onboarding-extract-psa.test.ts`, `tests/prompts/extract-psa.test.ts`, `tests/prompts/draft-rfp.test.ts` (and any other suite that imports a deleted A3 module; find them in step 2)

- [ ] **Step 1: Delete the directories and files**

```bash
cd <appdir>
git rm -r app/onboarding components/a3 app/api/onboarding
git rm lib/prompts/extract-psa.ts lib/prompts/draft-rfp.ts lib/prompts/lender-packet.ts
git rm db/seed/deals.ts db/seed/_a3-template.ts
```

- [ ] **Step 2: Find and delete A3 test files + any remaining importers**

Run:
```bash
grep -rlE "onboarding|components/a3|extract-psa|draft-rfp|lender-packet|seed/deals|_a3-template" tests/ app/ components/ lib/ db/ | sort -u
```
Expected: hits in `db/seed/index.ts`, `lib/notify.ts`, `components/shell/Sidebar.tsx`, `components/shell/StatusGrid.tsx` (handled in A2-A5), plus A3 test files. `git rm` every test file under `tests/` that imports a deleted module (at minimum the three named above; delete any other onboarding/PSA/RFP/lender test surfaced here).

### Task A2: Remove A3 seeding from the seed orchestrator

**Files:** Modify `db/seed/index.ts`

- [ ] **Step 1: Remove A3 imports and seed calls**

Open `db/seed/index.ts`. Remove the import of `buildDeals` / `_a3-template` helpers and the block that inserts deals, onboarding tasks, rfp drafts, and inbox events. Keep properties, units, OM seed, Foundry bulk-load seed, lease abstracts, FTS, and demo leads. Remove any A3 line from the final summary `console.log` (deals / onboarding tasks / rfp drafts / inbox events counts).

- [ ] **Step 2: Verify the seed file no longer references A3**

Run:
```bash
grep -nE "deal|onboarding|rfp|inbox|_a3" db/seed/index.ts
```
Expected: no matches (or only unrelated substrings; there should be no A3 seeding left).

### Task A3: Drop A3 tables + notification columns, prune NotifyKind, regenerate migration

**Files:** Modify `db/schema.ts`, `lib/notify.ts`; generate a migration.

- [ ] **Step 1: Remove A3 tables and notification columns from `db/schema.ts`**

Delete these table definitions entirely: `deals`, `onboardingTasks`, `rfpDrafts`, `inboxEvents`. In the `notifications` table, delete the three A3-only columns: `taskId`, `team`, `event` (keep `id`, `kind`, `title`, `body`, `link`, `createdAt`, `readAt`). Update the `kind` comment to drop `task_overdue`.

- [ ] **Step 2: Prune A3 NotifyKind values in `lib/notify.ts`**

Replace the `NotifyKind` union with only the surviving kinds:
```ts
export type NotifyKind =
  | "qualified_lead"        // L1: new lead qualified by the form engine
  | "extraction_complete"   // L2: lease extraction finished
  | "bulk_load_complete";   // A5: acquisition bulk-load finished
```

- [ ] **Step 3: Generate the drop migration and rebuild the DB**

Run:
```bash
pnpm db:generate
```
Expected: a new `db/migrations/00NN_*.sql` containing DROP TABLE for the four A3 tables and ALTER/recreate dropping the three notifications columns, plus an updated `db/migrations/meta/_journal.json`. Inspect the generated SQL.

```bash
pnpm db:reset
```
Expected: migrates and seeds clean; the summary line no longer mentions deals/onboarding tasks/rfp/inbox.

### Task A4: Remove A3 from the sidebar

**Files:** Modify `components/shell/Sidebar.tsx`

- [ ] **Step 1: Remove the A3 and A3 Blocker Center nav entries**

In the `NAV` definition, delete the "Onboarding" (A3) entry and the "A3 Blocker Center" (`/onboarding/blockers`) entry from the Acquisitions track. Acquisitions keeps A1 (`/market-intelligence`) and A5 (`/acquisition-bulk-load`); Leasing keeps L1, L2, C3.

- [ ] **Step 2: Verify no onboarding links remain**

Run: `grep -nE "onboarding|Blocker|A3" components/shell/Sidebar.tsx`
Expected: no matches.

### Task A5: Flatten the home grid to 5 demos and fix the hero copy

**Files:** Modify `components/shell/StatusGrid.tsx`, `app/page.tsx`

- [ ] **Step 1: Remove the A3 card and the tier split in `StatusGrid.tsx`**

Delete the A3 `DemoCard` from the `DEMOS` array. Remove the `tier` field usage, the `TIER_1`/`TIER_2` partition, and the two `TierHeading` groups. Render one grid of the five cards in order: A1, C3, L2, A5, L1 (keep L1's `versionTag: "Two versions"`; its `reframeNote` is rewritten in WS-B). Keep the `DemoCardItem` component and the grid container classes (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`).

- [ ] **Step 2: Fix the hero/about copy in `app/page.tsx`**

The grid now genuinely shows five demos, so "Five proof-of-concept demos" is correct. Confirm both paragraphs (lines ~19 and ~32) read "Five" and contain no reference to A3 / onboarding / Blocker Center / six demos.

Run: `grep -niE "six|onboarding|blocker|a3" app/page.tsx`
Expected: no matches.

### Task A6: Verify WS-A and commit

- [ ] **Step 1: Grep for any remaining live A3 references**

Run:
```bash
grep -rnE "onboarding|components/a3|extract-psa|draft-rfp|lender-packet|onboardingTasks|rfpDrafts|inboxEvents|\bdeals\b" app/ components/ lib/ db/seed/ db/schema.ts | grep -v "docs/"
```
Expected: no matches (ignore matches inside `docs/`, handled in WS-I).

- [ ] **Step 2: Build + test gate**

Run: `pnpm build` then `pnpm test`
Expected: build clean; tests green (lower count than 153 because A3 suites were removed). If a non-A3 test fails, fix the reference it lost.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(a3): remove the Onboarding demo entirely

Jordan declined A3 outright on the 4-Jun validation call (deal process is
human-owned and unpredictable; the checklist is an aid not a driver; financing
is a separate team and relationship-driven; DD RFPs are local handshake vendors).
Removes the routes, components, 12 API routes, 3 prompts, seed, and tests;
drops the deals/onboarding_tasks/rfp_drafts/inbox_events tables and the A3
notification columns; flattens the home grid to five demos.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# WS-B: L1 chat reframe (copy only)

### Task B1: Parameterize VersionBanner and reframe L1's copy

**Files:** Modify `components/shared/VersionBanner.tsx`, `app/chat-leasing/page.tsx`, `components/shell/StatusGrid.tsx`. Test: `tests/components/version-banner.test.ts` (new, light).

- [ ] **Step 1: Write a failing test for parameterized copy**

Create `tests/components/version-banner.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VersionBanner } from "@/components/shared/VersionBanner";

describe("VersionBanner", () => {
  it("renders custom proposal copy when provided", () => {
    const { getByText } = render(
      <VersionBanner version="proposal" proposalText="Jordan warmed to the chat" />,
    );
    expect(getByText(/Jordan warmed to the chat/)).toBeTruthy();
  });
  it("falls back to default reframed copy", () => {
    const { container } = render(<VersionBanner version="reframed" />);
    expect(container.textContent).toMatch(/Reframed/);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm vitest run tests/components/version-banner.test.tsx`
Expected: FAIL (VersionBanner does not accept `proposalText`).

- [ ] **Step 3: Add optional copy props to `VersionBanner.tsx`**

Change the signature to accept optional overrides while preserving current defaults:
```tsx
export function VersionBanner({
  version,
  proposalText,
  reframedText,
}: {
  version: DemoVersion;
  proposalText?: React.ReactNode;
  reframedText?: React.ReactNode;
}) {
  const proposal = version === "proposal";
  return (
    <div className={cn(/* keep existing className logic */)}>
      {proposal
        ? (proposalText ?? (
            <>
              <strong>FlexOps AI&apos;s original proposal.</strong> The client declined this path on the 29-May
              feedback; flip to &ldquo;Reframed&rdquo; to see the version we shipped.
            </>
          ))
        : (reframedText ?? (
            <>
              <strong>Reframed</strong> after Jordan &amp; Alex&apos;s 29-May feedback (the version currently
              deployed). Flip to &ldquo;Our proposal&rdquo; to see what we originally pitched.
            </>
          ))}
    </div>
  );
}
```
Add `import type React from "react";` if needed.

- [ ] **Step 4: Pass L1-specific copy from `app/chat-leasing/page.tsx`**

Where `<VersionBanner version={version} />` is rendered, pass:
```tsx
<VersionBanner
  version={version}
  proposalText={
    <>
      <strong>Original proposal: a conversational qualification chatbot.</strong> Jordan warmed to it on
      the 4-Jun demo (liked it more than expected) and sees practical use;
      viability depends on cost vs. website traffic. Deployable beyond the site (email signature, referral
      intake). Flip to &ldquo;Reframed&rdquo; for the structured-form backend.
    </>
  }
  reframedText={
    <>
      <strong>Structured-form qualification backend</strong> (the shipped default). Flip to &ldquo;Our
      proposal&rdquo; to see the conversational chatbot Jordan warmed to on 4-Jun.
    </>
  }
/>
```

- [ ] **Step 5: Update the L1 reframeNote in `StatusGrid.tsx`**

Change L1's `reframeNote` from "Conversational chatbot was declined; rebuilt as a structured-form qualification backend." to:
```
"Both a structured-form backend and the conversational chatbot are available; Jordan warmed to the chat on 4-Jun (pending cost vs. traffic)."
```

- [ ] **Step 6: Run the test + build, expect pass**

Run: `pnpm vitest run tests/components/version-banner.test.tsx` then `pnpm build`
Expected: PASS; build clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(l1): reframe chat from declined to warmed-to (cost vs traffic)

Jordan reversed the email no on 4-Jun. Parameterize VersionBanner copy (now
L1-only after A3 removal) and update the home reframeNote. No logic change;
both the form and chat versions stay.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# WS-C: L2 operating-expense recovery extraction (stated terms)

### Task C1: Add the OperatingExpenseRecovery schema to the lease abstract

**Files:** Modify `lib/prompts/extract-lease.ts`. Test: `tests/prompts/extract-lease.test.ts` (new).

- [ ] **Step 1: Write the failing test**

Create `tests/prompts/extract-lease.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LeaseAbstract } from "@/lib/prompts/extract-lease";

const base = {
  tenantName: "Acme Fab LLC", landlordName: "KFP", propertyAddress: "1 Industrial Blvd",
  suite: "101", leaseStart: "2024-01-01", leaseEnd: "2029-01-01",
  baseRentSchedule: [{ from: "2024-01-01", to: "2025-01-01", monthlyRent: 3000, annualRentPerSqft: 18 }],
  escalations: { type: "fixed_pct", details: "3%" }, renewalOptions: [],
  tiAllowancePerSqft: null, freeRentMonths: null, securityDeposit: 6000,
  cam: { type: "NNN", recoveryMethod: null, caps: null }, billingContact: null,
  estimatedRecoveryPsf: null, useClause: null, specialProvisions: [], rawSections: [],
  confidence: {},
};

describe("LeaseAbstract operatingExpenseRecovery", () => {
  it("parses a base-year-stop recovery block", () => {
    const parsed = LeaseAbstract.parse({
      ...base,
      operatingExpenseRecovery: {
        recoveryType: "base_year_stop", baseYear: 2024, recoveryMethod: "pro_rata_share",
        proRataSharePct: 4.2, expenseCategories: ["taxes", "insurance", "cam"],
        capPct: 5, reconciliationBasis: "calendar_year", notes: "Tenant pays pro-rata over base year.",
      },
    });
    expect(parsed.operatingExpenseRecovery?.recoveryType).toBe("base_year_stop");
  });
  it("parses with the recovery field absent (back-compat)", () => {
    const parsed = LeaseAbstract.parse(base);
    expect(parsed.operatingExpenseRecovery ?? null).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm vitest run tests/prompts/extract-lease.test.ts`
Expected: FAIL (unknown key `operatingExpenseRecovery`).

- [ ] **Step 3: Add the schema**

In `lib/prompts/extract-lease.ts`, before `LeaseAbstract`, add:
```ts
// Stated operating-expense recovery terms (Alex's 4-Jun ask: the most billing-
// critical Yardi field). Extracted from the lease's Operating Expenses / Additional
// Rent / CAM / Taxes / Insurance clauses. Stated terms only; reconciliation math
// against budgets is out of scope (the lease does not carry budget data).
export const OperatingExpenseRecovery = z.object({
  recoveryType: z.enum(["nnn_full", "base_year_stop", "modified_gross", "gross_none", "custom"]).nullable(),
  baseYear: z.number().int().nullable(),
  recoveryMethod: z.enum(["pro_rata_share", "fixed", "custom"]).nullable(),
  proRataSharePct: z.number().nullable(),
  expenseCategories: z.array(z.string()),
  capPct: z.number().nullable(),
  reconciliationBasis: z.enum(["calendar_year", "lease_year"]).nullable(),
  notes: z.string().nullable(),
});
export type OperatingExpenseRecovery = z.infer<typeof OperatingExpenseRecovery>;
```
Then add to `LeaseAbstract` (use `.nullable().optional()` so committed JSON without the field still parses):
```ts
  operatingExpenseRecovery: OperatingExpenseRecovery.nullable().optional(),
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm vitest run tests/prompts/extract-lease.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Update the extraction prompt**

In `extractLeasePrompt`, add a rule to the system prompt:
```
- Extract operatingExpenseRecovery from the Operating Expenses / Additional Rent / CAM / Real Estate Taxes / Insurance clauses: recoveryType (nnn_full = tenant pays its full pro-rata of all opex; base_year_stop = tenant pays increases over a base year; modified_gross; gross_none; custom), baseYear if a base year is set, recoveryMethod, proRataSharePct, the expenseCategories passed through, any capPct on controllable expenses, reconciliationBasis, and a short notes excerpt. Use null for any field the lease does not state; set expenseCategories to [] if none are listed. Mark low confidence when the recovery structure is ambiguous.
```
Add the field to the JSON shape block in the user prompt:
```
  "operatingExpenseRecovery": { "recoveryType": "nnn_full" | "base_year_stop" | "modified_gross" | "gross_none" | "custom" | null, "baseYear": int | null, "recoveryMethod": "pro_rata_share" | "fixed" | "custom" | null, "proRataSharePct": number | null, "expenseCategories": [string], "capPct": number | null, "reconciliationBasis": "calendar_year" | "lease_year" | null, "notes": string | null },
```
Also extend the rawSections instruction to always include the Operating Expenses / Additional Rent / CAM recovery clause when present (so C3 can cite it).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(l2): extract operatingExpenseRecovery (stated lease terms)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C2: Persist the recovery JSON column

**Files:** Modify `db/schema.ts`; generate migration.

- [ ] **Step 1: Add the column to `leaseAbstracts`**

In `db/schema.ts`, in `leaseAbstracts`, after `camTerms`, add:
```ts
  operatingExpenseRecovery: text("operating_expense_recovery"), // JSON OperatingExpenseRecovery (Alex 4-Jun ask)
```

- [ ] **Step 2: Generate + apply**

Run: `pnpm db:generate` then `pnpm db:reset`
Expected: new migration adds `operating_expense_recovery` to `lease_abstracts`; reseeds clean.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(l2): add operating_expense_recovery column to lease_abstracts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C3: Seed recovery data + recovery rawSection on example leases

**Files:** Modify `db/seed/lease-abstracts.ts`

- [ ] **Step 1: Populate operatingExpenseRecovery on >=3 seeded abstracts**

For at least three abstracts spanning the lease types, set `operatingExpenseRecovery` and write it to the inserted row (JSON.stringify into the new column). Use distinct shapes:
- one NNN: `{ recoveryType: "nnn_full", baseYear: null, recoveryMethod: "pro_rata_share", proRataSharePct: <n>, expenseCategories: ["taxes","insurance","cam","management"], capPct: null, reconciliationBasis: "calendar_year", notes: "Tenant pays its pro-rata share of all operating expenses (NNN)." }`
- one base-year-stop (modified gross): `{ recoveryType: "base_year_stop", baseYear: 2024, recoveryMethod: "pro_rata_share", proRataSharePct: <n>, expenseCategories: ["taxes","insurance","cam"], capPct: 5, reconciliationBasis: "calendar_year", notes: "Tenant pays increases over the 2024 base year, 5% cap on controllables." }`
- one gross: `{ recoveryType: "gross_none", baseYear: null, recoveryMethod: null, proRataSharePct: null, expenseCategories: [], capPct: null, reconciliationBasis: null, notes: "Gross lease; landlord absorbs operating expenses." }`

For those leases add a rawSection `{ section: "Operating Expenses / Additional Rent", page: <n>, text: "<verbatim-style recovery clause matching the structured fields>" }` so C3 retrieval can cite it.

- [ ] **Step 2: Reseed + spot check**

Run: `pnpm db:reset`
Then verify at least one row carries the JSON:
```bash
pnpm tsx -e "import {db,schema} from './db/client'; const r=await db.select({t:schema.leaseAbstracts.tenantName,o:schema.leaseAbstracts.operatingExpenseRecovery}).from(schema.leaseAbstracts); console.log(r.filter(x=>x.o).slice(0,3));"
```
Expected: at least three rows print a non-null recovery JSON.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(l2): seed operating-expense recovery examples + raw sections

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C4: Surface recoveries in the AbstractEditor

**Files:** Modify `components/l2/AbstractEditor.tsx`

- [ ] **Step 1: Render a "Recoveries" field group**

Read the file to follow its existing field-group + confidence pattern. Parse `operatingExpenseRecovery` from the abstract JSON and render a "Recoveries" group with fields: Recovery type, Base year, Method, Pro-rata share %, Expense categories (comma-joined), Cap %, Reconciliation basis, Notes. Route low/medium-confidence recovery fields into the existing "Needs review" group exactly as other fields do. Inline edits commit via the existing PUT-on-blur path (extend the editable field set / PUT payload to include `operatingExpenseRecovery`).

- [ ] **Step 2: Build + manual check**

Run: `pnpm build`
Expected: clean. (Manual: `pnpm dev`, open `/lease-abstraction`, select a seeded lease, confirm the Recoveries group shows.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(l2): show operating-expense recoveries in the abstract editor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C5: Show recovery setup in the Yardi paste-ready modal

**Files:** Modify `components/l2/PushToYardiModal.tsx`

- [ ] **Step 1: Add a recovery setup block**

Read the file to follow its section/label-value pattern. In the charge-schedule section (where EstUtil is emitted), add recovery context derived from `operatingExpenseRecovery`: recovery type, base year (if any), method + pro-rata share %, reconciliation basis. Keep the existing EstUtil $/sqft line. Suppress the recovery block for `gross_none` / when the field is null, matching the existing NNN/EstUtil suppression style.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(l2): include recovery setup in the Yardi paste-ready modal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C6: Make the recovery answerable in C3

**Files:** Modify `lib/retrieval.ts`. Test: `tests/lib/retrieval-recovery.test.ts` (new) or extend an existing retrieval test.

- [ ] **Step 1: Write a failing test for a recovery classifier**

Read `lib/retrieval.ts` for the existing `mentions*` classifier pattern (e.g. `mentionsLoanDocs`). Create `tests/lib/retrieval-recovery.test.ts` asserting a recovery-intent classifier returns true for representative queries:
```ts
import { describe, it, expect } from "vitest";
import { mentionsRecovery } from "@/lib/retrieval";

describe("mentionsRecovery", () => {
  it("fires on operating-expense recovery questions", () => {
    expect(mentionsRecovery("what is the operating expense recovery for Acme?")).toBe(true);
    expect(mentionsRecovery("base year and pass-throughs for suite 5")).toBe(true);
    expect(mentionsRecovery("CAM reconciliation method")).toBe(true);
  });
  it("does not fire on unrelated questions", () => {
    expect(mentionsRecovery("when does the lease expire?")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm vitest run tests/lib/retrieval-recovery.test.ts`
Expected: FAIL (`mentionsRecovery` not exported).

- [ ] **Step 3: Implement the classifier + side-path**

In `lib/retrieval.ts`, add and export:
```ts
export function mentionsRecovery(query: string): boolean {
  return /operating expense|opex|recover|pass[- ]?through|base year|reconcil|cam|estutil|additional rent/i.test(query);
}
```
Wire it like the other side-paths: when it fires, ensure the recovery rawSections (Operating Expenses / Additional Rent / CAM) for the named lease (or all leases when none is named) are pulled into the retrieval pool so the LLM cites them.

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm vitest run tests/lib/retrieval-recovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Build + full test gate + commit**

Run: `pnpm build` then `pnpm test`
Expected: clean + green.
```bash
git add -A
git commit -m "feat(c3): surface operating-expense recovery sections for recovery queries

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# WS-D: C3 richer default outputs + NOI-lift

### Task D1: Add size + rent/sqft to ScheduleRow and an analysis field to LeaseAnswer

**Files:** Modify `lib/prompts/lease-intelligence.ts`. Test: extend `tests/prompts/lease-intelligence.test.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/prompts/lease-intelligence.test.ts`:
```ts
describe("ScheduleRow + analysis enrichment", () => {
  it("accepts size and rent per sqft on a schedule row", () => {
    const parsed = LeaseAnswer.parse({
      answer: "schedule", citations: [], table: null,
      schedule: [{ propertyAddress: "100 Example Way", tenant: "Acme", leaseEnd: "2027-06-30", sizeSqft: 2400, rentPerSqft: 18.5 }],
      analysis: { noiLiftAnnual: 12000, expiringCount: 2, basis: "market rent vs in-place at rollover" },
    });
    expect(parsed.schedule?.[0].sizeSqft).toBe(2400);
    expect(parsed.analysis?.noiLiftAnnual).toBe(12000);
  });
  it("still parses with analysis absent", () => {
    const parsed = LeaseAnswer.parse({ answer: "x", citations: [], table: null });
    expect(parsed.analysis ?? null).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm vitest run tests/prompts/lease-intelligence.test.ts`
Expected: FAIL (unknown keys `sizeSqft` / `analysis`).

- [ ] **Step 3: Extend the schemas**

In `lib/prompts/lease-intelligence.ts`, add to `ScheduleRow`:
```ts
  sizeSqft: z.number().nullable().optional(),
  rentPerSqft: z.number().nullable().optional(),
```
Add a new schema and field on `LeaseAnswer`:
```ts
export const AnswerAnalysis = z.object({
  noiLiftAnnual: z.number(),
  expiringCount: z.number().int(),
  basis: z.string(),
});
```
In `LeaseAnswer`, add (keep the .nullable().optional() guarantee):
```ts
  analysis: AnswerAnalysis.nullable().optional(),
```

- [ ] **Step 4: Update the prompt**

In `leaseIntelligencePrompt` system text: instruct that schedule rows must include `sizeSqft` and `rentPerSqft` when the context provides them; that for per-property expiration queries the model should fill `analysis` with the anticipated NOI lift from a provided "NOI Lift (system)" context line when present; and that for terse queries (e.g. just a property name) it should return the headline rental items (tenant, suite, size, rent/sqft, lease end, renewal) by default rather than asking for clarification. Add `sizeSqft`/`rentPerSqft` to the schedule shape and the `analysis` object to the JSON schema block.

- [ ] **Step 5: Run, expect pass; commit**

Run: `pnpm vitest run tests/prompts/lease-intelligence.test.ts`
Expected: PASS.
```bash
git add -A
git commit -m "feat(c3): schedule rows carry size + rent/sqft; add NOI-lift analysis field

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task D2: NOI-lift pure function

**Files:** Modify `lib/uw.ts`. Test: `tests/lib/noi-lift.test.ts` (new).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/noi-lift.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { noiLiftFromExpirations } from "@/lib/uw";

describe("noiLiftFromExpirations", () => {
  it("sums positive market-over-in-place lift across expiring leases", () => {
    const lift = noiLiftFromExpirations(
      [
        { inPlaceRentPsf: 18, sizeSqft: 2000 }, // (21-18)*2000 = 6000
        { inPlaceRentPsf: 22, sizeSqft: 1000 }, // above market -> 0
        { inPlaceRentPsf: null, sizeSqft: 1500 }, // unknown -> skipped
      ],
      21,
    );
    expect(lift).toBe(6000);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm vitest run tests/lib/noi-lift.test.ts`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement in `lib/uw.ts`**

```ts
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
```

- [ ] **Step 4: Run, expect pass; commit**

Run: `pnpm vitest run tests/lib/noi-lift.test.ts`
Expected: PASS.
```bash
git add -A
git commit -m "feat(c3): noiLiftFromExpirations helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task D3: Wire size/rent + NOI-lift into the per-property expiration path

**Files:** Modify `lib/retrieval.ts`, `app/api/lease/intelligence/route.ts`

- [ ] **Step 1: Enrich the expiration schedule context with size + rent**

Read the per-property expiration grouping in `lib/retrieval.ts` (the "Expiration Schedule (system)" builder). For each lease in the group, source `sizeSqft` and in-place `rentPerSqft`: join the `units` table by the abstract's property + suite (bulk_load Foundry units carry both; for L2 leases use the linked unit when present, else `baseRentSchedule[0].annualRentPerSqft` for rent and null for size). Include size and rent/sqft in the system section text per lease so the LLM can emit them on schedule rows.

- [ ] **Step 2: Compute and inject the NOI-lift line**

When the per-property expiration path fires, compute `noiLiftFromExpirations(group, marketRentPsf)` where `marketRentPsf = getUwAssumptions(submarket, {isBuiltOut, isExpansion:false}).marketRentPsf` (or `FOUNDRY_UW.marketRentPsf` for Foundry). Add a context line `NOI Lift (system): anticipated annual NOI lift at rollover ~$<n> across <count> expiring leases (market rent vs in-place)` so the LLM fills `analysis`. (If the route assembles context, do the compute there and pass it in; keep retrieval pure where possible.)

- [ ] **Step 3: Build + smoke**

Run: `pnpm build`
Expected: clean. (Manual: `pnpm dev`, `/lease-intelligence`, click the Foundry expiration chip; the schedule shows size + rent/sqft columns and an NOI-lift stat.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(c3): expiration answers carry size + rent/sqft and an NOI-lift stat

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task D4: Render size/rent columns + NOI-lift in the C3 client

**Files:** Modify `components/c3/LeaseIntelligenceClient.tsx`

- [ ] **Step 1: Render the enriched schedule + analysis**

Read the schedule-block render. Add Size and Rent/SF columns to the schedule table (render "-" when null). Above the schedule, when `message.analysis` is present, render a headline stat: "Anticipated NOI lift at rollover: ~$<noiLiftAnnual>/yr across <expiringCount> expiring leases" with the `basis` as a small caption. Follow the existing typographic treatment (Plex Mono for figures).

- [ ] **Step 2: Build + commit**

Run: `pnpm build`
Expected: clean.
```bash
git add -A
git commit -m "feat(c3): show size/rent columns and the NOI-lift stat in the UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# WS-E: A1 yield-on-cost x stabilized-rent sensitivity table

### Task E1: sensitivityMatrix() engine

**Files:** Modify `lib/uw.ts`. Test: `tests/lib/uw-sensitivity.test.ts` (new).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/uw-sensitivity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sensitivityMatrix, underwriteProperty } from "@/lib/uw";
import { FOUNDRY_UW } from "@/lib/uw-assumptions";

describe("sensitivityMatrix", () => {
  const totalSqft = FOUNDRY_TOTAL_SF; // from the Foundry seed data
  const basePrice = Math.round(FOUNDRY_UW.acquisitionBasisPsf * totalSqft);

  it("center cell matches underwriteProperty yield-on-cost", () => {
    const m = sensitivityMatrix({
      basePurchasePrice: basePrice,
      baseStabilizedRentPsf: FOUNDRY_UW.marketRentPsf,
      totalSqft, a: FOUNDRY_UW,
    });
    const center = m.cells[1][1].yieldOnCostPct;
    const expected = underwriteProperty([], FOUNDRY_UW, totalSqft).yieldOnCostPct;
    expect(Math.abs(center - expected)).toBeLessThan(0.0005);
  });

  it("produces a 3x3 grid with cost-to-stabilize and target", () => {
    const m = sensitivityMatrix({
      basePurchasePrice: basePrice, baseStabilizedRentPsf: FOUNDRY_UW.marketRentPsf,
      totalSqft, a: FOUNDRY_UW,
    });
    expect(m.rows).toHaveLength(3);
    expect(m.cols).toHaveLength(3);
    expect(m.cells.length).toBe(3);
    expect(m.cells[0].length).toBe(3);
    expect(m.costToStabilize).toBe(Math.round(FOUNDRY_UW.capexToDemisePsf * totalSqft));
    expect(m.targetYoCPct).toBeGreaterThan(0);
  });

  it("yield falls as price rises and rises as rent rises", () => {
    const m = sensitivityMatrix({
      basePurchasePrice: basePrice, baseStabilizedRentPsf: FOUNDRY_UW.marketRentPsf,
      totalSqft, a: FOUNDRY_UW,
    });
    expect(m.cells[0][1].yieldOnCostPct).toBeGreaterThan(m.cells[2][1].yieldOnCostPct); // lower price -> higher YoC
    expect(m.cells[1][2].yieldOnCostPct).toBeGreaterThan(m.cells[1][0].yieldOnCostPct); // higher rent -> higher YoC
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm vitest run tests/lib/uw-sensitivity.test.ts`
Expected: FAIL (`sensitivityMatrix` not exported).

- [ ] **Step 3: Implement in `lib/uw.ts`**

```ts
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
```
Note: the center cell uses `priceSteps[1]=0` and `rentSteps[1]=0`, so it equals `underwriteProperty` YoC when `basePurchasePrice = a.acquisitionBasisPsf*totalSqft` and `baseStabilizedRentPsf = a.marketRentPsf` (allInCost includes reserves in both; `underwriteProperty` adds `reservesPsf*totalSqft` too).

- [ ] **Step 4: Run, expect pass; commit**

Run: `pnpm vitest run tests/lib/uw-sensitivity.test.ts`
Expected: PASS (all three).
```bash
git add -A
git commit -m "feat(a1): sensitivityMatrix engine (yield-on-cost x price x rent)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task E2: Return the matrix from the property route

**Files:** Modify `app/api/properties/[id]/units/route.ts`

- [ ] **Step 1: Compute and return the matrix**

After `underwriting` is computed, add:
```ts
import { underwriteProperty, sensitivityMatrix } from "@/lib/uw";
// ...
const sensitivity = sensitivityMatrix({
  basePurchasePrice: underwriting.acquisitionPrice,
  baseStabilizedRentPsf: assumptions.marketRentPsf,
  totalSqft,
  a: assumptions,
});
return NextResponse.json({ data: { property, units, sourceDoc, underwriting, sensitivity }, error: null });
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(a1): return the sensitivity matrix from the property route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task E3: Render the sensitivity grid in CompDetailPanel

**Files:** Modify `components/a1/CompDetailPanel.tsx`

- [ ] **Step 1: Render the grid as the headline of Property Underwriting**

Read the file's Property Underwriting section. Add a sensitivity grid at the top of that section from `data.sensitivity`: a table with purchase-price row labels (`label` + formatted `$M`) down the left, stabilized rent/sqft `label`s across the top, and each cell showing `yieldOnCostPct` as a percent, tone-colored (`good` -> `var(--tone-emerald-*)`, `mid` -> amber, `low` -> rose) using the existing tone classes. Below the grid: a "Cost to stabilize: ~$<costToStabilize>" line and a "target >= <targetYoCPct>%" caption. Wrap the whole block in a small "first pass: pending Alex's written spec, 2nd underwriting model, and ground-up development models" badge/footnote. Keep the existing unit-level UW comparison below it.

- [ ] **Step 2: Build + full test + smoke**

Run: `pnpm build` then `pnpm test`
Expected: clean + green. (Manual: `pnpm dev`, `/market-intelligence`, select a Foundry comp, confirm the grid renders with the base cell matching the going-in figure.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(a1): sensitivity table as the headline A1 underwriting output (first pass)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# WS-I: Docs sync

### Task I1: Backpropagate the changes into the docs

**Files:** `CLAUDE.md`, `solution_builds.md`, the session log, `README.md`, `app/market-intelligence/process.md`, `app/lease-abstraction/process.md`, `app/lease-intelligence/process.md`, `app/chat-leasing/process.md`, the master synthesis (kept outside the repo), `docs/process/current-vs-demo-mapping.md`. Delete `app/onboarding/process.md` was already removed with the route.

- [ ] **Step 1: Update CLAUDE.md**

Remove A3 from the active demo list, the Demo Build Queue (delete the A3 section), the tiering paragraph (now five demos, no Tier 1/Tier 2 split; or keep "validated headliners" language without A3). Record A3 as declined on 4-Jun with Jordan's reasoning in a short "Declined" note. Update the architecture-target line (five demos, no `/onboarding/blockers`). Update L1 to note the chat is a live option again. Add an L2 note that operating-expense recovery is now extracted. Add a C3 note about size/rent defaults + NOI-lift. Add an A1 note about the sensitivity table (first pass). Keep the no-em-dash rule.

- [ ] **Step 2: Update solution_builds.md, README.md, process.md files, synthesis + mapping**

Mirror the same changes: drop A3 sections/route references; L1 chat reframed to "maybe"; L2 recovery field; C3 enriched defaults; A1 sensitivity. Fix any "six demos" / Blocker Center references. Ensure each surviving demo's `process.md` reflects the new behavior.

- [ ] **Step 3: Add the session-log entry**

Prepend a new dated entry summarizing the 4-Jun-feedback session: A3 removed, L1 chat reframed, L2 recovery added, C3 enriched, A1 sensitivity added, three new solution tracks scoped separately; validation results; restore tag + worktree noted; open items (Alex's A1 written spec, 2nd UW + dev models; Sam's absorption + historical-performance files).

- [ ] **Step 4: Run the end-of-session checklist + final gates**

Run: `pnpm test` then `pnpm build` then `pnpm db:reset`
Expected: green + clean + seeds. Em-dash grep over the diff is empty.
```bash
git add -A
git commit -m "docs: backpropagate post-validation suite changes (A3 removed, L1/L2/C3/A1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (author check)

- **Spec coverage:** WS-A..E + docs each map to spec sections 4-9; the three new-solution tracks are explicitly out of this plan (separate scoping deliverable) per spec section 1.
- **Type consistency:** `operatingExpenseRecovery` shape identical in `extract-lease.ts`, seed, and editor; `sensitivityMatrix`/`SensitivityMatrix`/`SensitivityCell` names consistent across E1/E2/E3; `noiLiftFromExpirations` signature consistent D2/D3; `analysis`/`AnswerAnalysis` consistent D1/D3/D4.
- **Migrations:** schema-driven via `pnpm db:generate` then `pnpm db:reset` (the repo's mechanism); two generate steps (A3 drop, OpEx add) can be combined if A2/C2 run back-to-back, but are kept separate for clean commits.
- **Back-compat:** new optional/nullable fields (`operatingExpenseRecovery`, `sizeSqft`/`rentPerSqft`, `analysis`) use `.nullable().optional()` so committed pre-extracted JSON still parses.
