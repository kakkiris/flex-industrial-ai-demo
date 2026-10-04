# Both-Versions Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the original (pre-29-May-feedback) and the reframed (current) versions of L1 and A3 both runnable in the live demo, switchable per page via a `?v=proposal|reframed` toggle, with reframed as the default and an A5-added / L3-retired narrative note.

**Architecture:** A shared `VersionToggle` + `VersionBanner` read/write a `?v=` query param (absent ⇒ `reframed`). The L1 (`/chat-leasing`) and A3 (`/onboarding`, `/onboarding/blockers`) page shells read the version and render either the current reframed component tree or a restored "proposal" tree. The originals are restored from git history (`<pre-reframe-L1-commit>` for L1, `<pre-reframe-A3-commit>` for A3) at their historic, now-free paths; their components are renamed only where they would collide with a current file. Both versions read one shared, superset DB seed.

**Tech Stack:** Next.js 16 App Router (client components, `useSearchParams`), React 19, Drizzle + better-sqlite3, Tailwind v4, Anthropic SDK, Vitest + Testing Library.

**Working branch:** `feat/both-versions-toggle` (already created; the design spec is committed there).

---

## File structure

**New (this plan authors):**
- `lib/version.ts` — `DemoVersion` type + `parseVersion()` (pure).
- `components/shared/VersionToggle.tsx` — segmented `?v=` link control.
- `components/shared/VersionBanner.tsx` — framing strip per version.
- `components/l1/ChatProposalView.tsx` — thin wrapper rendering the restored chat widget (in the mock-site chrome).
- `components/a3/OnboardingProposalView.tsx` — the original orchestration dashboard body (lifted from `app/onboarding/page.tsx` in an earlier version).
- `lib/prompts/leasing-chat-original.ts` — the restored 5-step chat prompt (kept separate so the current `leasing-chat.ts` type export is untouched).
- `tests/lib/version.test.ts` — unit test for `parseVersion`.

**Restored from git (deleted by the reframe; brought back at original paths):**
- L1 (from an earlier version, before the L1 reframe): `components/l1/ChatWidget.tsx`, `components/l1/KeystoneMockSite.tsx`, `app/api/chat/leasing/route.ts`, `app/api/chat/leasing/complete/route.ts`, `tests/api/leasing-complete.test.ts`.
- A3 (from an earlier version, before the A3 reframe): `app/api/onboarding/{draft-rfp,lender-packet,inbox,inbox/simulate,blocker-action,task-notifications,rfp-drafts/[id]}/route.ts`; `components/a3/{TaskList,InboxMonitoringPanel,LenderPacketPanel,PerTaskNotifications,RFPDraftTabs}.tsx`; `lib/prompts/{draft-rfp,lender-packet}.ts`; `tests/prompts/draft-rfp.test.ts`. Plus the original action-laden BlockerCenter restored as `components/a3/BlockerCenterOriginal.tsx` (renamed to avoid clobbering the current passive `BlockerCenter.tsx`).

**Modified (reframed versions kept; toggle wired in):**
- `app/chat-leasing/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding/blockers/page.tsx`, `app/acquisition-bulk-load/page.tsx`, the home card source (`components/shell/StatusGrid.tsx` or `app/page.tsx`), `db/seed/deals.ts`, `db/seed/index.ts`.

---

## Task 1: Version helper + shared toggle/banner (TDD)

**Files:**
- Create: `lib/version.ts`, `tests/lib/version.test.ts`, `components/shared/VersionToggle.tsx`, `components/shared/VersionBanner.tsx`

- [ ] **Step 1: Write the failing test**

`tests/lib/version.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseVersion } from "@/lib/version";

describe("parseVersion", () => {
  it("returns 'proposal' only for the exact 'proposal' value", () => {
    expect(parseVersion("proposal")).toBe("proposal");
  });
  it("defaults to 'reframed' for null/undefined/empty/unknown", () => {
    expect(parseVersion(null)).toBe("reframed");
    expect(parseVersion(undefined)).toBe("reframed");
    expect(parseVersion("")).toBe("reframed");
    expect(parseVersion("chat")).toBe("reframed");
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `pnpm vitest run tests/lib/version.test.ts`
Expected: FAIL — `Cannot find module '@/lib/version'`.

- [ ] **Step 3: Implement `lib/version.ts`**

```ts
export type DemoVersion = "proposal" | "reframed";

// Default to the shipped (reframed) version unless the caller explicitly asks
// for the original proposal. Keep this pure so it is trivially testable.
export function parseVersion(v: string | null | undefined): DemoVersion {
  return v === "proposal" ? "proposal" : "reframed";
}
```

- [ ] **Step 4: Run it; verify it passes**

Run: `pnpm vitest run tests/lib/version.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `components/shared/VersionToggle.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DemoVersion } from "@/lib/version";

// Segmented control that sets ?v= on the current route. "reframed" is the
// default, so selecting it removes the param (clean URL). Kept presentational:
// the page passes the parsed `current` version in.
export function VersionToggle({ current }: { current: DemoVersion }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (v: DemoVersion) => {
    const sp = new URLSearchParams(params.toString());
    if (v === "reframed") sp.delete("v");
    else sp.set("v", v);
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const Opt = ({ v, label }: { v: DemoVersion; label: string }) => (
    <Link
      href={href(v)}
      scroll={false}
      aria-current={current === v ? "true" : undefined}
      className={cn(
        "px-3 py-1 rounded-sm font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors",
        current === v ? "bg-foreground text-background" : "text-foreground-muted hover:bg-foreground/[0.06]",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
      <Opt v="proposal" label="Our proposal" />
      <Opt v="reframed" label="Reframed (current)" />
    </div>
  );
}
```

- [ ] **Step 6: Create `components/shared/VersionBanner.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { DemoVersion } from "@/lib/version";

// One-line framing strip so the "both sides" story reads in a walkthrough.
export function VersionBanner({ version }: { version: DemoVersion }) {
  const proposal = version === "proposal";
  return (
    <div
      className={cn(
        "rounded-sm border px-3 py-2 text-xs leading-relaxed",
        proposal
          ? "border-[var(--tone-violet-dot)]/40 bg-[var(--tone-violet-tint)] text-[var(--tone-violet-text)]"
          : "border-border bg-background-subtle text-foreground-muted",
      )}
    >
      {proposal ? (
        <>
          <strong>FlexOps AI&apos;s original proposal.</strong> The client declined this path on the 29-May
          feedback; flip to &ldquo;Reframed&rdquo; to see the version we shipped.
        </>
      ) : (
        <>
          <strong>Reframed</strong> after Jordan &amp; Alex&apos;s 29-May feedback (the version currently
          deployed). Flip to &ldquo;Our proposal&rdquo; to see what we originally pitched.
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify the new files typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors referencing the three new files. (Pre-existing unrelated errors, if any, are out of scope.)

- [ ] **Step 8: Commit**

```bash
git add lib/version.ts tests/lib/version.test.ts components/shared/VersionToggle.tsx components/shared/VersionBanner.tsx
git commit -m "feat(demo): version toggle helper + shared VersionToggle/VersionBanner"
```

---

## Task 2: L1 — restore the chatbot files (no wiring yet)

**Files:** restore from an earlier version (before the L1 reframe); create `lib/prompts/leasing-chat-original.ts`.

- [ ] **Step 1: Restore the deleted chatbot files at their original paths**

```bash
git checkout <pre-reframe-L1-commit> -- \
  components/l1/ChatWidget.tsx \
  components/l1/KeystoneMockSite.tsx \
  app/api/chat/leasing/route.ts \
  app/api/chat/leasing/complete/route.ts
```
(Run from the repo root. These four paths are absent today, so nothing is overwritten.)

- [ ] **Step 2: Restore the original chat prompt into a NEW file (do not clobber the current type export)**

The current `lib/prompts/leasing-chat.ts` exports the `AvailableUnit` type the form path uses. The original 5-step chat prompt lived in the same file in an earlier version. Extract it into a separate file:
```bash
git show <pre-reframe-L1-commit>:lib/prompts/leasing-chat.ts > lib/prompts/leasing-chat-original.ts
```
Then open `lib/prompts/leasing-chat-original.ts` and **delete the `AvailableUnit` type export** from it (that type now lives canonically in `leasing-chat.ts`); add `import type { AvailableUnit } from "@/lib/prompts/leasing-chat";` if the restored prompt references it. The file should export the chat system prompt / state-machine builder used by the restored routes.

- [ ] **Step 3: Repoint the restored chat routes at the original prompt file**

In `app/api/chat/leasing/route.ts` and `app/api/chat/leasing/complete/route.ts`, change any import of the chat prompt from `@/lib/prompts/leasing-chat` to `@/lib/prompts/leasing-chat-original`. Leave imports of still-present modules (`extract-lead`, `match-units`, `anthropic`, `db`) as-is.

- [ ] **Step 4: Reconcile imports in the restored components**

Open `components/l1/ChatWidget.tsx` and `components/l1/KeystoneMockSite.tsx`. If either imports a shared component that has since changed (e.g., an inline status pill), repoint it to the current `@/components/shared/StatusPill` where the signature matches. Resolve any TS error by following the current sibling component's usage.

- [ ] **Step 5: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in the restored L1 files. Fix import/type errors until clean.

- [ ] **Step 6: Commit**

```bash
git add components/l1/ChatWidget.tsx components/l1/KeystoneMockSite.tsx \
        app/api/chat/leasing lib/prompts/leasing-chat-original.ts \
        app/api/chat/leasing/complete/route.ts
git commit -m "feat(l1): restore chatbot widget, mock site, chat routes, and original chat prompt"
```

---

## Task 3: L1 — wire the toggle into `/chat-leasing`

**Files:** Create `components/l1/ChatProposalView.tsx`; Modify `app/chat-leasing/page.tsx`.

- [ ] **Step 1: Create the proposal view wrapper**

`components/l1/ChatProposalView.tsx`:
```tsx
"use client";
import { KeystoneMockSite } from "@/components/l1/KeystoneMockSite";
import { ChatWidget } from "@/components/l1/ChatWidget";

// Renders the original conversational lead-qualification experience inside the
// mock keystoneflex.example chrome, exactly as it was proposed before the form reframe.
export function ChatProposalView() {
  return (
    <KeystoneMockSite>
      <ChatWidget />
    </KeystoneMockSite>
  );
}
```
Adjust the JSX if `ChatWidget` / `KeystoneMockSite` export different names or expect props — read the restored files and match their real signatures (e.g., `KeystoneMockSite` may already embed the widget itself, in which case render just `<KeystoneMockSite />`).

- [ ] **Step 2: Convert `app/chat-leasing/page.tsx` into a version-switching shell**

Read the current file first to preserve its header text/description. It currently renders `ChatLeasingTabs`. Rewrite it as a `Suspense`-wrapped body that reads the version and switches:
```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { parseVersion } from "@/lib/version";
import { VersionToggle } from "@/components/shared/VersionToggle";
import { VersionBanner } from "@/components/shared/VersionBanner";
import { ChatLeasingTabs } from "@/components/l1/ChatLeasingTabs";
import { ChatProposalView } from "@/components/l1/ChatProposalView";

function Body() {
  const version = parseVersion(useSearchParams().get("v"));
  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">
            Website Lead Qualification
          </h1>
          <p className="text-sm text-foreground-muted leading-relaxed max-w-2xl">
            {/* PRESERVE the current description text from the existing file here */}
          </p>
        </div>
        <VersionToggle current={version} />
      </header>
      <VersionBanner version={version} />
      {version === "proposal" ? <ChatProposalView /> : <ChatLeasingTabs />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
```
Keep the exact description paragraph that exists today (copy it from the current file). Do not change `ChatLeasingTabs` or `/api/leads`.

- [ ] **Step 3: Build and smoke-check both versions**

```bash
pnpm build && pnpm db:reset && (pnpm start > /tmp/v.log 2>&1 &) && sleep 6
curl -s -o /dev/null -w "reframed %{http_code}\n" "http://localhost:3000/chat-leasing"
curl -s -o /dev/null -w "proposal %{http_code}\n" "http://localhost:3000/chat-leasing?v=proposal"
```
Expected: both `200`. (The page is client-rendered; 200 confirms the route + bundle build for both. Manual browser check of the actual chat UI is in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add components/l1/ChatProposalView.tsx app/chat-leasing/page.tsx
git commit -m "feat(l1): version toggle on /chat-leasing (chatbot proposal vs. form reframed)"
```

---

## Task 4: A3 — restore the orchestration / auto-comms files (no wiring yet)

**Files:** restore from an earlier version (before the A3 reframe); create `components/a3/BlockerCenterOriginal.tsx`.

- [ ] **Step 1: Restore the deleted A3 routes, components, and prompts**

```bash
git checkout <pre-reframe-A3-commit> -- \
  app/api/onboarding/draft-rfp/route.ts \
  app/api/onboarding/lender-packet/route.ts \
  app/api/onboarding/inbox/route.ts \
  app/api/onboarding/inbox/simulate/route.ts \
  app/api/onboarding/blocker-action/route.ts \
  app/api/onboarding/task-notifications/route.ts \
  'app/api/onboarding/rfp-drafts/[id]/route.ts' \
  components/a3/TaskList.tsx \
  components/a3/InboxMonitoringPanel.tsx \
  components/a3/LenderPacketPanel.tsx \
  components/a3/PerTaskNotifications.tsx \
  components/a3/RFPDraftTabs.tsx \
  lib/prompts/draft-rfp.ts \
  lib/prompts/lender-packet.ts
```
All of these are absent today (deleted in an earlier version), so nothing current is overwritten.

- [ ] **Step 2: Restore the original action-laden BlockerCenter under a new name**

The current `components/a3/BlockerCenter.tsx` is the passive (reframed) version — keep it. Restore the original (with draft-email/escalate/contact actions) alongside it:
```bash
git show <pre-reframe-A3-commit>:components/a3/BlockerCenter.tsx > components/a3/BlockerCenterOriginal.tsx
```
Open `BlockerCenterOriginal.tsx` and rename the exported component to `BlockerCenterOriginal` (so it does not collide with the current `BlockerCenter` export).

- [ ] **Step 3: Reconcile `lib/notify.ts` if the restored routes need a dropped NotifyKind**

The A3 reframe (an earlier version) removed ~5 lines from `lib/notify.ts`. If any restored route imports a `NotifyKind` value that no longer exists, add it back **additively** to the union in `lib/notify.ts` (do not remove current kinds). Run `tsc` to surface which, if any.

- [ ] **Step 4: Reconcile remaining imports in the restored A3 files**

Open each restored component/route and fix imports against the current tree: point status pills at `@/components/shared/StatusPill`, confirm `@/lib/notify`, `@/lib/anthropic`, `@/db/client`, and `@/lib/prompts/*` imports resolve. The restored routes write to existing tables (`rfp_drafts`, `inbox_events`, `notifications`, `onboarding_tasks.payload`) — all present in the current schema.

- [ ] **Step 5: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: clean (no errors in restored A3 files). Fix until clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/onboarding components/a3 lib/prompts/draft-rfp.ts lib/prompts/lender-packet.ts lib/notify.ts
git commit -m "feat(a3): restore orchestration routes, panels, prompts, and the action BlockerCenter"
```

---

## Task 5: A3 — restore the superset seed

**Files:** Modify `db/seed/deals.ts`, `db/seed/index.ts`.

- [ ] **Step 1: Compare current vs. original deals seed**

Run: `git diff <seed-reframe-commit>^ <seed-reframe-commit> -- db/seed/deals.ts db/seed/index.ts | head -200`
This shows exactly what the reframe pruned (financing tasks, seeded `inbox_events`, per-task notifications, RFP-draft seed, the drafts join). The originals to re-add are on the pre-reframe side.

- [ ] **Step 2: Re-add the auto-comms seed elements to `db/seed/deals.ts`**

Bring back, from the pre-reframe version of `db/seed/deals.ts`, onto the **current** `buildDeals()`: (a) a **financing task** on the demo deal (so `LenderPacketPanel` has a target), (b) ≥1 **`rfp_draft`** row, (c) the seeded **`inbox_events`** rows, and (d) the per-task **`notifications`** rows the original seeded. Keep the current Linwood-aligned checklist and team labels intact — you are adding rows, not replacing the structure. Return the new arrays from `buildDeals()` (e.g. extend the returned object with `rfpDrafts`, `inboxEvents`, and the extra `notifications`).

- [ ] **Step 3: Insert the restored rows in `db/seed/index.ts`**

Ensure `index.ts` inserts the new arrays (`rfp_drafts`, `inbox_events`, and the extra notifications) after the deals/tasks insert, mirroring the original ordering in the pre-reframe version of `db/seed/index.ts`. The wipe list already clears these tables.

- [ ] **Step 4: Reseed and verify both A3 versions have data**

```bash
pnpm db:reset
```
Expected: seed completes with no FK errors; console reports deals + tasks as before, now also reporting the rfp_drafts / inbox_events / notifications counts. Then confirm the reframed dashboard still renders correctly on the richer seed (Task 6 will verify in-browser).

- [ ] **Step 5: Commit**

```bash
git add db/seed/deals.ts db/seed/index.ts
git commit -m "feat(a3): superset seed so both the orchestration and visibility versions have data"
```

---

## Task 6: A3 — extract the proposal view and wire the toggle

**Files:** Create `components/a3/OnboardingProposalView.tsx`; Modify `app/onboarding/page.tsx`, `app/onboarding/blockers/page.tsx`.

- [ ] **Step 1: Create `OnboardingProposalView.tsx` from the original page body**

Read the pre-reframe version of `app/onboarding/page.tsx` (`git show <pre-reframe-A3-commit>:app/onboarding/page.tsx`). Lift its dashboard body — the JSX that renders `TaskList`, `InboxMonitoringPanel`, `LenderPacketPanel`, `PerTaskNotifications`, `RFPDraftTabs`, plus the property/team/timeline panels — into a new client component `components/a3/OnboardingProposalView.tsx`. It owns its own `useQuery(["deals"])` fetch (same `/api/onboarding/deals` source) and `selectedDealId` state, identical to how the original page worked. Repoint any import that changed (e.g. `StatusPill`). Do not include a `<VersionToggle>` inside it — the shell owns that.

- [ ] **Step 2: Convert `app/onboarding/page.tsx` into a version-switching shell**

Wrap the current body in a `Suspense` + version read. Preserve the current reframed body (lines that render `DealBookRollup`, `DealList`, `PropertyDetailsPanel`, `TeamRosterPanel`, `DealTimeline`, the A5 handoff card, `ChecklistPanel`) — move it into a local `ReframedView` (inline or its own component) — and switch:
```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { parseVersion } from "@/lib/version";
import { VersionToggle } from "@/components/shared/VersionToggle";
import { VersionBanner } from "@/components/shared/VersionBanner";
import { OnboardingProposalView } from "@/components/a3/OnboardingProposalView";
// ...existing imports for the reframed body...

function Body() {
  const version = parseVersion(useSearchParams().get("v"));
  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">Onboarding</h1>
          {/* PRESERVE the current description paragraph */}
        </div>
        <div className="flex items-center gap-2">
          <VersionToggle current={version} />
          {/* keep the existing "Open Blocker Center" link; append ?v=proposal when version==="proposal" */}
        </div>
      </header>
      <VersionBanner version={version} />
      {version === "proposal" ? <OnboardingProposalView /> : <ReframedView />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
```
Make the "Open Blocker Center" link carry the version: `href={version === "proposal" ? "/onboarding/blockers?v=proposal" : "/onboarding/blockers"}`.

- [ ] **Step 3: Wire `/onboarding/blockers` to the version**

Convert `app/onboarding/blockers/page.tsx` to read `?v=` (Suspense + `useSearchParams`) and render `BlockerCenterOriginal` when `proposal`, else the current `BlockerCenter`. Add a `VersionToggle` + `VersionBanner` at the top so the page is reachable/labeled on its own.

- [ ] **Step 4: Build and smoke-check both versions**

```bash
pnpm build && pnpm db:reset && (pnpm start > /tmp/v.log 2>&1 &) && sleep 6
for u in "/onboarding" "/onboarding?v=proposal" "/onboarding/blockers" "/onboarding/blockers?v=proposal"; do
  curl -s -o /dev/null -w "$u -> %{http_code}\n" "http://localhost:3000$u"; done
```
Expected: all `200`.

- [ ] **Step 5: Commit**

```bash
git add components/a3/OnboardingProposalView.tsx app/onboarding/page.tsx app/onboarding/blockers/page.tsx
git commit -m "feat(a3): version toggle on /onboarding + /onboarding/blockers (orchestration vs. visibility)"
```

---

## Task 7: A5 + L3 before/after narrative note

**Files:** Modify `app/acquisition-bulk-load/page.tsx` (and reuse `VersionBanner` styling or a small inline strip).

- [ ] **Step 1: Add a narrative strip to the A5 page**

At the top of the A5 page body (read the current file first), add a small violet-toned note (reuse the `VersionBanner` visual treatment, or an inline `<div>` with the same classes):
> "A5 was **added** in the 2026-05-31 restructure. It absorbs the **retired standalone L3** — the single-lease Yardi path became L2, and the bulk acquisition path became A5."

No toggle, no restored code — this is framing only.

- [ ] **Step 2: Build check**

Run: `pnpm build` → clean.

- [ ] **Step 3: Commit**

```bash
git add app/acquisition-bulk-load/page.tsx
git commit -m "docs(a5): before/after note that A5 was added and L3 retired in the restructure"
```

---

## Task 8: Home grid indicators

**Files:** Modify the home grid source (`components/shell/StatusGrid.tsx` or `app/page.tsx` — read both to find where the demo cards render).

- [ ] **Step 1: Add a "two versions" indicator to the L1 and A3 cards**

On the L1 (`/chat-leasing`) and A3 (`/onboarding`) cards, add a small muted tag: "Two versions — toggle on the page." Add the A5-added/L3-retired one-liner to the A5 card. Match the existing card tag styling (mono uppercase chip pattern already used in `StatusGrid`).

- [ ] **Step 2: Build check + commit**

```bash
pnpm build
git add components/shell/StatusGrid.tsx app/page.tsx
git commit -m "feat(home): flag L1/A3 as two-version and note A5/L3 on the home grid"
```

---

## Task 9: Restore and reconcile tests; full suite green

**Files:** restore `tests/api/leasing-complete.test.ts` and `tests/prompts/draft-rfp.test.ts` from earlier versions; keep all current tests.

- [ ] **Step 1: Restore the deleted tests**

```bash
git checkout <pre-reframe-L1-commit> -- tests/api/leasing-complete.test.ts
git checkout <pre-reframe-A3-commit> -- tests/prompts/draft-rfp.test.ts
```

- [ ] **Step 2: Reconcile imports in the restored tests**

If `leasing-complete.test.ts` imports the chat prompt, repoint it to `@/lib/prompts/leasing-chat-original`. If `draft-rfp.test.ts` imports `draft-rfp` prompt, confirm the path matches the restored `lib/prompts/draft-rfp.ts`. Fix any drifted assertion against the restored code's actual output.

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: all suites pass — the current 140 plus the restored ones (target ≥ 142). Fix any failure (import path, changed schema field) until green.

- [ ] **Step 4: Commit**

```bash
git add tests/api/leasing-complete.test.ts tests/prompts/draft-rfp.test.ts
git commit -m "test: restore L1 chat-complete and A3 draft-rfp suites for the proposal versions"
```

---

## Task 10: Integration verification

**Files:** none (verification + final fixes).

- [ ] **Step 1: Full gate**

```bash
pnpm lint && pnpm test && pnpm build
```
Expected: lint clean, tests green, build clean.

- [ ] **Step 2: Run a clean prod build and exercise both versions**

```bash
pnpm db:reset && (pnpm start > /tmp/v.log 2>&1 &) && sleep 6
for u in "/chat-leasing" "/chat-leasing?v=proposal" "/onboarding" "/onboarding?v=proposal" \
         "/onboarding/blockers" "/onboarding/blockers?v=proposal" "/acquisition-bulk-load"; do
  curl -s -o /dev/null -w "$u -> %{http_code}\n" "http://localhost:3000$u"; done
```
Expected: all `200`.

- [ ] **Step 3: Manual browser checklist (acceptance criteria from the spec)**

- `/chat-leasing` default = form + inbox; `?v=proposal` = the chatbot in the mock site; both create a lead.
- `/onboarding?v=proposal` = orchestration panels (RFP drafts, lender packet, inbox monitoring, per-task notifications); `/onboarding/blockers?v=proposal` = action-laden Blocker Center; default = visibility-only dashboard + passive blocker list.
- Default (no `?v=`) is identical to the current reframed demo.
- A5 page + home show the A5-added / L3-retired note.

- [ ] **Step 4: Stop. Do not deploy.**

Report completion and the verification results. Deployment (push → PR → merge to `main`, which auto-deploys) is a **separate, explicitly-confirmed** step per the project's git convention — do not push without the user's go-ahead.

---

## Notes for the executor

- **Restores are exact:** `git checkout <ref> -- <path>` brings back the precise historical file. After every restore, run `tsc` and fix only the imports that drifted (shared components, the renamed chat prompt, any additive `NotifyKind`). Do not "improve" restored code.
- **Never clobber the reframed versions:** only restore files that are absent today; rename on collision (`BlockerCenterOriginal`, `leasing-chat-original`).
- **The seed is shared and superset:** both A3 versions read it; the reframed view must keep rendering correctly on the richer data (verify in Task 6/10).
- **Out of scope:** L2/DocuSign toggle, a global version switch, any A1/C3 change, and deployment.
