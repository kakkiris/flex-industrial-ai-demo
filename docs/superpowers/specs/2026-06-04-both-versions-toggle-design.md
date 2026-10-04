# Both-Versions Toggle — "Our Proposal vs. Reframed" — Design Spec

**Date:** 2026-06-04
**Status:** Approved design, pre-implementation
**Topic:** Make the original (pre-feedback) and the reframed (post-feedback) versions of L1 and A3 both runnable in the live demo, behind a per-page version toggle.

---

## Context & motivation

The demo suite was reframed per Jordan & Alex's **29-May email feedback** and the **2026-05-31 restructure**:

- **L1** went from a conversational **chatbot** to a **form-backed qualifier** (in an earlier version).
- **A3** dropped its **auto-communication path** (AI-drafted DD RFPs, Sonnet lender packet, deposit reminders, simulated inbox monitoring, Blocker Center chase/escalate actions) and became **visibility-only** (across a few earlier commits).
- **A5** was **added**, absorbing the retired standalone **L3** (single-lease path → L2, bulk path → A5).

These changes are committed and deployed on `main`; the originals remain intact in git history. We now want to **show both sides in the live demo** — FlexOps AI's original proposal *and* the client-feedback-reframed version, each runnable — so a walkthrough can contrast "what we proposed" with "how we adapted." The reframed version stays the default; nothing is reverted.

## Goals

1. **L1** and **A3** each expose a per-page **version toggle** (Our proposal ⟷ Reframed), default reframed, both versions fully runnable.
2. **A5 / L3** restructure is framed with a before/after note (no toggle — A5 is additive, there is no "original without A5").
3. The current reframed experience is **unchanged** in the default (no-toggle) state.
4. Both test suites (restored originals + current) pass; build and lint clean.

## Non-goals

- L2's DocuSign → manual-upload change (a separate decision) — no toggle.
- A global, app-wide version switch — per-page is sufficient (YAGNI).
- Any behavioral change to A1 or C3.
- Reverting any reframe. Both versions coexist; the reframed version remains canonical/default.

## Approach: per-page toggle via a `?v=` query param

- A shared **`<VersionToggle>`** control (segmented: `Our proposal` / `Reframed ✓`) sets a URL query param **`?v=proposal|reframed`** (absent ⇒ `reframed`). A query param (rather than only local state) makes a version **deep-linkable/bookmarkable** for the walkthrough and lets `/onboarding` and `/onboarding/blockers` share one selection.
- A shared **`<VersionBanner>`** strip renders under the toggle:
  - *proposal mode:* "FlexOps AI's original proposal — the client declined this path on the 29-May feedback. Flip to the reframed version we shipped."
  - *reframed mode:* "Reframed after Jordan & Alex's 29-May feedback. Flip to see our original proposal."
- Each page reads `v` and renders the matching component tree. The two versions' API routes **coexist at distinct paths** — the originals' historic paths are currently free (they were deleted, not reused), so there are no collisions.

## L1 — restore the chatbot (lighter lift)

Restore from an earlier version (the commit before the L1 reframe):

- **Components:** `components/l1/ChatWidget.tsx`, `components/l1/KeystoneMockSite.tsx`.
- **Routes:** `app/api/chat/leasing/route.ts` (streaming chat), `app/api/chat/leasing/complete/route.ts` (persist verdict on completion). Both paths are currently free.
- **Prompt:** the original 5-step state-machine body of `lib/prompts/leasing-chat.ts`. The current file was reduced to a type export the form path uses — restore the chat prompt as an **additional named export**, do not overwrite the type.
- **Page:** `app/chat-leasing/page.tsx` reads `?v=`. `reframed` → current `ChatLeasingTabs` (form + inbox). `proposal` → the chat widget (optionally wrapped in `KeystoneMockSite` chrome). The form path (`POST /api/leads`) and inbox are untouched and remain default.

## A3 — restore the orchestration / auto-comms version (heavier lift)

Restore from an earlier version (the commit before the auto-comms strip; at that commit the action-laden `BlockerCenter` also still exists):

- **Routes:** `app/api/onboarding/{draft-rfp, lender-packet, inbox, inbox/simulate, blocker-action, task-notifications, rfp-drafts/[id]}`. All currently free.
- **Components:** `InboxMonitoringPanel`, `LenderPacketPanel`, `PerTaskNotifications`, `RFPDraftTabs`, and the original action-laden `BlockerCenter`.
- **Prompts:** `lib/prompts/draft-rfp.ts`, `lib/prompts/lender-packet.ts`.
- **Page:** `app/onboarding/page.tsx` reads `?v=`. `reframed` → current visibility-only panels. `proposal` → the original orchestration panels (lifted from the pre-reframe page layout).
- **Blocker Center:** `app/onboarding/blockers/page.tsx` reads `?v=`. `proposal` → original `BlockerCenter` (draft-email via Haiku / escalate / contact-info actions). `reframed` → current passive overdue list. Restore the one `NotifyKind` the auto-comms path used in `lib/notify.ts` if the original routes require it (additive).

## A5 + L3 — before/after narrative (no toggle)

A `<VersionBanner>`-style note on the **A5 page** (`/acquisition-bulk-load`) and a one-liner on the **home grid**: "A5 was added in the 2026-05-31 restructure; it absorbs the retired standalone L3 — single-lease path → L2, bulk path → A5." No restored code.

## Seed reconciliation (the main implementation care-point)

The reframe pruned `db/seed/deals.ts` (it dropped the financing tasks, `inbox_events`, per-task notifications, and RFP-draft seed the auto-comms version needs). Decision: **one shared, superset seed.** Restore the auto-comms seed elements (a financing task + ≥1 RFP draft on a demo deal, seeded `inbox_events`, seeded per-task notifications) on top of the current Linwood-aligned `deals.ts`. The reframed A3 ignores the extras (it renders only the checklist + overdue list); **verify it still renders correctly on the richer dataset.** No regression to the A1/L1/L2/C3 seed.

## Schema

No migration expected — the fields the originals need already exist in `db/schema.ts`: the `chat_sessions`, `inbox_events`, and `rfp_drafts` tables; `onboarding_tasks.payload`; `notifications.task_id / team / event`; and the `leads` verdict / confidence / reasoning columns. Confirm during implementation; if any required field was dropped, add an **additive** migration only.

## Navigation / framing

- Sidebar unchanged (6 demos + Blocker Center). The toggle is on-page.
- Home grid: the L1 and A3 cards get a subtle "two versions — toggle on the page" indicator; the A5 card carries the before/after note.

## Testing

- Restore the deleted tests (`tests/api/leasing-complete.test.ts`, `tests/prompts/draft-rfp.test.ts`, and the original `leasing-chat` assertions) alongside the current suites, so **both** the original and reframed paths are covered. Target: full suite green (current 140 + restored).
- Add a small route test asserting both `?v=` modes resolve (200) for `/chat-leasing` and `/onboarding`.

## Acceptance criteria

1. `/chat-leasing?v=proposal` renders the chatbot and completes a qualification; `?v=reframed` (and no param) renders the current form + inbox. Both persist a lead.
2. `/onboarding?v=proposal` renders the orchestration panels (RFP drafts, lender packet, inbox monitoring, per-task notifications); `/onboarding/blockers?v=proposal` shows the action-laden Blocker Center. `?v=reframed` renders the current visibility-only dashboard + passive blocker list.
3. The default (no `?v=`) experience is identical to the current reframed demo.
4. The A5 page and home grid show the A5-added / L3-retired note.
5. `pnpm build` clean; `pnpm test` green (current + restored); `pnpm lint` clean.
6. Both versions verified in a running production build.

## Risks & mitigations

- **A3 integration (highest risk):** ~14 resurrected files must compile/run against the current schema/lib/seed. Mitigation: restore from the pre-reframe commit as a set, fix imports, reconcile the seed, test per file group.
- **Superset seed breaking the reframed A3 view:** verify the reframed dashboard on the richer seed; if a panel mis-renders, gate the extra rows to the original components only.
- **`leasing-chat.ts` export collision:** restore the chat prompt as an additional named export; never overwrite the type the form path imports.
- **Shared-component drift:** the originals predate some shared-component consolidation (e.g. `StatusPill`); repoint restored components at the current shared components where signatures match.

## Open questions

None blocking. Toggle labels and banner copy use the defaults above; can be tuned during implementation.
