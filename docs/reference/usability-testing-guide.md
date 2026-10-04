# Usability Testing Guide (2026-05-31)

Hands-on validation of the current suite: the restructure (L2/A5 split, L1/A3 reframes, C3/A1 strengthening, retired L3, tiering), the underwriting methodology, and the scope-fit audit fixes (Tiers 1-3). Each section says what to click and what to expect, with **VERIFY** checkpoints for the specific changes. Total time about 40 to 60 minutes. This reflects what is actually built, not what an older spec describes.

## 0. Setup and mechanics

- The app is served in production mode at `http://localhost:3000`. If it is not running, from the repo root: `pnpm build && pnpm start` (production is more stable for a walkthrough than `pnpm dev`). Run only ONE server; do not start a second one on the same port.
- After any restart or rebuild, **hard-refresh** the browser (Cmd+Shift+R).
- `.env.local` must have `ANTHROPIC_API_KEY=...`. C3 (chat answers) and L1 (form qualification) make live Anthropic calls, so those responses take a few seconds.
- To restore the demo data to a clean baseline at any time: `pnpm db:reset` (this is also what the deployed app does on start). A fresh seed prints the seeded counts (properties, units, deals, onboarding tasks, lease abstracts, demo form leads) plus a `Foundry bulk-load:` line with the bulk-loaded lease, occupied-unit, and vacant-shell counts.
- If the build ever breaks with a missing-file error from a stale untracked file, run `git clean -fdn` to preview, then `git clean -fd`.

### Home page: `/`
- [ ] The demo grid is grouped into two tiers: **Tier 1 - Validated headliners** (A1, C3, L2, A5) and **Tier 2 - We heard you (reframed)** (L1, A3).
- [ ] **VERIFY (restructure):** the two Tier 2 cards carry a "we heard you" reframe note (L1 = chatbot declined, rebuilt as a structured-form backend; A3 = auto-communication declined, rebuilt as a visibility dashboard).
- [ ] **VERIFY:** A5 "Acquisition Bulk-Load" is present (Tier 1, BUILD PARTIAL / needs Yardi access). A2 is not in the grid. No "L3" standalone.
- [ ] Sidebar: the Acquisitions track shows A1, A3 Blocker Center, A5; the L1 nav reads "L1 Leasing Qualification" with a form (not chat) icon.

---

## 1. A1 Market Intelligence: `/market-intelligence` (Tier 1)

What it does: searchable rent comps across the KFP portfolio + 3 ingested OMs + Foundry, with confidence tiers and a real underwriting comparison.

### Happy path
1. [ ] Page loads with comps; the aggregate header shows count, median $/sqft, range, and a **Bathroom premium** stat (with-bathroom vs without-bathroom median).
2. [ ] Click any comp row; the right detail panel opens.

### VERIFY the underwriting methodology (the headline change)
- [ ] In the detail panel, **Performance to UW** is the prominent, color-coded headline: a unit BELOW market reads **green** ("below market", acquisition upside); a unit above market reads amber ("above market", rollover risk). It is no longer a flat +8.7% everywhere; it varies across comps.
- [ ] The detail panel has an **Underwriting** block: going-in cap rate, market rent range, mark-to-market upside, in-place + stabilized NOI, yield-on-cost, basis $/sqft.
- [ ] **Foundry check:** filter Submarket to Foundry's submarket (or find "Foundry Business Center") and open a Foundry comp. The Underwriting block shows the going-in cap computed from the deal inputs and a positive (green) mark-to-market upside. Foundry in-place rents read below market (the deal's in-place band; see the seed data).
- [ ] **Built-out MG calibration:** a built-out (office + bathroom) Modified-Gross Marisol comp (e.g. Parkhurst / Westbrook) shows rent in the **$27-30/sqft** band.

### VERIFY the forward-fill transparency story (Tier 1 fix)
- [ ] On a LEGACY/internal comp (the synthetic KFP portfolio, not an OM or Foundry), the detail panel shows **"pending capture"** for **Tenant Category** and **Clear Height** (genuinely empty, the honest data gap). Earlier these were silently back-filled; now the badge fires on the legacy portfolio.
- [ ] Confirm legacy comps still appear by default (the clear-height filter does not hide null-clear-height rows unless you actively narrow the slider).
- [ ] **Bathroom delta:** the header "Bathroom premium" figure is the real one-click delta (median with vs without a private bathroom). Toggle the Bathroom Y/N filter and watch the comp set change.
- [ ] **Category filter caveat (expected, not a bug):** if you select a Tenant Category in the sidebar, the legacy portfolio drops out (those units have no captured category). A small note under the category list discloses this. This is the honest data-gap behavior.

### OM ingest (optional, ~30-60s)
- [ ] Click "Ingest a new OM PDF", upload any broker OM PDF (the client samples are not shipped with this repo). A new property + units appear, run through the same underwriting engine, and the new submarket appears in the geo filter.

---

## 2. C3 Lease Document Intelligence: `/lease-intelligence` (Tier 1)

What it does: natural-language chat over the lease corpus (the L2 abstracts + the Foundry bulk-loaded leases + its vacant shells), with cited answers.

### VERIFY the marquee questions answer the CORRECT tenant (the critical fix)
- [ ] The portfolio view shows **8 suggested-query chips** (HVAC responsibility, per-property expiration schedule, leases expiring next quarter, compare net effective rents, lender consent / loan docs, renewal options, free rent in year 1, TI > $10/sqft).
- [ ] Click the **HVAC responsibility** chip (it names a tenant, e.g. "Copper Loop LLC"). The answer must be **about that named tenant** and cite that tenant's "Maintenance and HVAC Responsibility" section. (Before the fix it answered about the wrong tenant.)
- [ ] Click the **lender consent / loan docs** chip (same named tenant). The answer must be about that tenant and cite its "Lender Consent and Loan Documents" section.

### VERIFY the new structured + cross-corpus capabilities
- [ ] Click the **per-property tenant expiration schedule** chip. The answer renders a **structured schedule block** (a table of tenant / suite / lease-end / days-to-expiry), not just prose.
- [ ] Ask **"what units are empty and rentable at Foundry?"** (or click an availability-style chip). The answer surfaces the **vacant Foundry shells** (this is A5 feeding C3 the available-to-rent inventory).
- [ ] **Citations resolve:** click a citation chip on any answer (including the schedule / availability answers). It opens the source section in the right panel; it no longer silently does nothing. (Real lease-section citations also offer "Open in L2".)
- [ ] **Cross-demo link:** from L2's abstract editor there is an "Ask C3 about this lease" link that deep-links here and auto-asks about that lease; confirm the round-trip.

---

## 3. L2 Automated Lease Abstraction: `/lease-abstraction` (Tier 1)

What it does: a SINGLE new lease signed on an already-owned property, abstracted and prepared for the one-person Yardi create-through-activate sequence. (Bulk acquisition inheritance is A5, not L2.)

### VERIFY the single-lease Yardi-UI framing (restructure)
- [ ] The header reads "Lease Abstraction (Single-Lease Yardi Entry)" and names the five Yardi steps: create lease, attach billing contact, add unit, build charge schedules, activate. The narrative explicitly says bulk inheritance is A5's path.

### VERIFY the abstraction surface now fits the five Yardi steps (audit fix)
- [ ] Open a seeded lease in the editor. The abstract now includes a **Billing contact** group (name/company/phone/email) - this is the Yardi "attach billing contact" step that was previously named but not captured.
- [ ] Click **"Push to Yardi"**. The paste-ready output is **grouped into the five Yardi entities**: CommLeases (create) -> CommContacts (billing) -> CommUnitXrefs/CommUnits (unit) -> CommChargeSchedules (the **Rent line with each escalation step PLUS an EstUtil recoveries line** for modified-gross) -> Activate. The description and the table agree (no more rent-roll-column dump).

### VERIFY the DocuSign-sim review flow + the upload bug fix
- [ ] Click **"Simulate signed lease"** in the DocuSign inbox panel. A new lease arrives as **"Awaiting review"**; open it, correct any low-confidence field, click **"Approve and push to Yardi"**; it flips to "Pushed".
- [ ] **Upload-bug check:** upload a lease PDF via the uploader. It must land as **"Awaiting review"** (not falsely "Pushed"). Earlier an uploaded lease wrongly showed as already activated.
- [ ] Persona: the review is attributed to the **leasing team** (not accounting).

---

## 4. A5 Acquisition Lease Bulk-Load: `/acquisition-bulk-load` (Tier 1, NEW)

What it does: a closing rent roll + unit inventory emits the six linked Yardi commercial ETL tables in one bulk load. Worked example: the Foundry deal.

### VERIFY the six-table emit (the core of A5)
- [ ] The Foundry deal card shows the property address, total SF, and occupied + vacant counts from the seed data. The "Upload closing rent roll (.xls)" affordance is intentionally **disabled with "Needs Yardi access"** (live ingest is out of scope; the committed dataset drives the demo).
- [ ] Click **"Emit Yardi ETL tables"**. The **Bulk-upload summary** shows the counts (leases, occupied units, vacant shells, total SF) matching the deal card.
- [ ] The **six-table preview** has a tab per table (CommLeases / CommUnitXrefs / CommUnits / CommSQFTs / CommChargeSchedules / CommContacts) with row counts. On CommUnits / CommSQFTs, the **vacant units are tagged "vacant shell"** (occupied units fan out across all six tables; vacant units appear only in CommUnits + CommSQFTs).
- [ ] **VERIFY (audit fix) Closing credits:** below the preview, a **"Closing credits to buyer (unpaid leasing costs)"** panel lists the leases carrying unpaid leasing costs and an aggregate total (fictional figures patterned on a PSA schedule; see the seed data).
- [ ] **CommContacts check:** on the CommContacts tab, entity tenants show the company in Company with a blank Last Name; the few individual tenants show a first/last name. (Not the company name duplicated into Last Name.)

---

## 5. L1 Leasing Qualification Backend: `/chat-leasing` (Tier 2)

What it does: the conversational chatbot was declined; this is the form-backend version. A structured form scores a lead and matches it to available units.

### VERIFY the reframe (restructure)
- [ ] There is **NO chat widget / mock website**. The tab shows an **Inquiry Form** (location, square footage, business type, business name, additional criteria) and a Leasing Team Inbox. No conversational UI anywhere.

### VERIFY qualification + match-to-units (~few seconds, live LLM)
- [ ] Submit a good-fit lead (e.g. location Brightwater, ~1,800 sqft, "HVAC contractor", a business name, "grade-level loading, move in 60 days"). The toast confirms routing to the leasing team.
- [ ] Open the lead in the inbox: it shows a **verdict** (qualified / manual_review / unqualified), a **confidence score**, a **reasoning** line, the **three-tier capture** of fields, and a **matched-units** panel (vacant units ranked by submarket + nearest size).
- [ ] Submit a clear non-fit (e.g. a public retail storefront) and confirm it reads **unqualified** with reasoning.
- [ ] The inbox is non-empty on a fresh seed (3 demo leads across the three verdicts) and sorts manual_review first.
- [ ] Note: if you have just run the test suite, the form-lead test wipes the seeded form leads; run `pnpm db:reset` to restore them.

---

## 6. A3 Property Onboarding: `/onboarding` and `/onboarding/blockers` (Tier 2)

What it does: the auto-communication was declined; this is the visibility-only consolidated dashboard, plus a closing handoff to A5.

### VERIFY the reframe (restructure + audit fix)
- [ ] **No auto-communication anywhere:** no "draft email", "send RFP", "chase", "escalate", or "lender packet" actions. The copy reads **"visibility-only"** (the team keeps status by hand), not "read-only".
- [ ] **Cross-deal Deal Book (audit fix):** the top of `/onboarding` shows a **Deal Book** rollup table listing every active deal side by side (property, status, tasks complete X/Y, overdue count, closing date). Clicking a deal expands its per-deal detail below. The Deal Book "overdue" total reconciles with the Blocker Center.
- [ ] Select a deal: the checklist (every task, owner, due, status), the property/team panels, and the deal timeline render. You can manually mark a task complete/in-progress (this manual status-keeping is intentional; it is not auto-communication).
- [ ] **Closing -> A5 handoff:** select a `closing` or `closed` deal (Linwood is closed, Coastal is closing). A **handoff card** appears linking to `/acquisition-bulk-load`, and the timeline shows a 5th milestone "Bulk-load to Yardi (A5)".
- [ ] `/onboarding/blockers` (A3 Blocker Center): a passive cross-deal list of overdue tasks (property, task, team, due date, days overdue). No action buttons.

---

## 7. Cross-demo chains (validate the suite hangs together)
- [ ] **L2 -> C3:** simulate/approve a lease in L2, then ask C3 about that tenant; it answers with a citation within seconds.
- [ ] **A5 -> C3:** A5's Foundry bulk leases are answerable in C3 (the named-tenant chips use them), and the vacant shells surface as available-to-rent.
- [ ] **A3 -> A5:** the closing handoff card on `/onboarding` routes to `/acquisition-bulk-load`.
- [ ] **A5/L1/A1 share vacancy:** a unit with no tenant is "available" everywhere (L1 matches against it, C3 reports it empty, A1 shows it vacant).

---

## What is intentional (do NOT flag these as bugs)
- A5's `.xls` upload is disabled ("needs Yardi access"); the committed Foundry dataset drives the demo.
- A1 synthetic-portfolio going-in caps read low (~1.5-5.5%) because those buildings carry ~30% modeled vacancy; that is a correct in-place cap (the upside shows in mark-to-market + stabilized NOI). Foundry (nearly fully occupied) is the clean example.
- Selecting a Tenant Category filter excludes the legacy portfolio (those units have a genuine pending-capture gap); a note discloses it.
- A2 (voice agent) is off the bench and out of scope this round.
- L3 was retired as a standalone item (its single-lease path is L2, its bulk path is A5).
- The empty-value dash placeholder in tables is a display glyph, not data.

## If something looks broken
- Blank/unstyled page: hard-refresh; if it persists, you likely have two servers fighting `.next` - kill all `next` processes, `rm -rf .next`, `pnpm build && pnpm start`.
- Stale data: `pnpm db:reset`.
- C3 / L1 slow or erroring: confirm `ANTHROPIC_API_KEY` is set in `.env.local`.

---

## Findings scratchpad
Record each finding and classify it: (a) code bug to fix, (b) intentional demo gap (see the list above), or (c) doc drift.

- A1:
- C3:
- L2:
- A5:
- L1:
- A3:
- Cross-demo:
