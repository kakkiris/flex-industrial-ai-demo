# Current vs Demo Process Mapping (All Demos)

Top-level index of how each active demo maps to KFP's existing process. For full per-demo detail (numbered current steps with source citations, demo steps with replace/augment/new tags, mapping table, what's not covered), click through to each demo's `process.md`.

The demo set is five active demos, presented as a flat list (A1, C3, L2, A5, L1); the earlier Tier 1 / Tier 2 "we heard you" split was retired on 2026-06-04 when A3 was declined. A3 (Property Onboarding) was declined by Jordan on the 4-Jun validation call and removed from the suite entirely (see the declined-solution note below). A2 (Voice Agent for Acquisition Cold Calling) was removed from the active build on 2026-05-26; its reference script was kept internally. L3 (Yardi Data Entry Automation) was retired as a standalone item on 2026-05-31; its single-lease path is absorbed by L2, its bulk path by A5. The 4-Jun session also surfaced three NEW solution tracks (Portfolio Absorption Reporting, Historical Operating Performance Reporting, Website-to-Yardi Vacancy Sync), summarized in `CLAUDE.md` (Phase 2 / Roadmap).

---

## A1: Market Intelligence Dashboard

**Today.** Alex maintains two 54-column Excel rent rolls quarterly-synced from Yardi by copy-paste; new-market evaluation requires manually reading OMs from CoStar / LoopNet / brokers; legacy vs KFP-signed performance is tagged by hand; UW comparisons are trended manually per lease ([Discovery-Alex 02:58, 03:33, 04:46, 07:26], [Discovery-Jordan 14:06]).

**Demo replaces.** Pre-seeded KFP-profile portfolio (8 properties / 106 units) plus three ingested broker OMs delivered by Sam (fictionalized) (Crestview → Gateway Commerce Center, Uptown → Riverside Flex Portfolio, Meridian = 3 properties / 86 units); pre-extracted JSON committed at `db/seed/extracted/` so seed is LLM-free; filter sidebar with the Bathroom (Y/N), Office (Y/N), Tenant Category (multi-select from distinct DB values), Clear Height (range) filters Jordan asked about plus dynamic submarket list (new OM submarkets auto-appear); "Ingest OM" returns propertyName + unitCount + submarket on success and toasts the result; confidence-tiered comps with source citations.

**Demo augments.** Legacy vs KFP indicator surfaced from `legacyRent`/`kfpRent` columns; Underwriting Comparison section in the detail panel (comp rent vs UW rent, trended at lease, deviation %, Performance-to-UW + Leased / Vacancy / Combined Impact, color-coded above/below flag).

**Demo new.** Tenant Category + Clear Height transparency: rows surface these fields with a "pending capture" italic badge where empty rather than hiding the gap. Yield-on-cost sensitivity table (added 2026-06-04, first pass): the Property Underwriting section leads with a yield-on-cost grid, purchase price (rows) x stabilized rent per sqft (cols), each cell computed by the same `lib/uw.ts` engine (so the base cell matches the headline going-in / YoC figure), with a cost-to-stabilize sub-line, badged "first pass". Alex's primary desired A1 output [Validation 2026-06-04], [Discovery-Alex].

**Demo does not cover.** Quarterly Yardi sync (production integration), NNN/MG operating-expense add-back normalization, backfill of Tenant Category and Clear Height on legacy units, asset-management presentations; the full underwriting model (the sensitivity table is a first pass pending Alex's written underwriting spec, a second underwriting model, and ground-up development models, none yet provided) [Validation 2026-06-04].

→ Full detail: [`app/market-intelligence/process.md`](../../app/market-intelligence/process.md)

---

## A3: Property Onboarding (DECLINED 2026-06-04)

A3 was declined by Jordan on the 4-Jun validation call and removed from the suite entirely (no `/onboarding` route, no Blocker Center, no A3 components / APIs / prompts / seed / tests, and the `deals` / `onboarding_tasks` / `rfp_drafts` / `inbox_events` tables were dropped). Jordan's reasoning: the deal process is human-owned and unpredictable; the onboarding checklist is an aid, not the driver; financing is a separate team, iterative and relationship-driven; and DD RFP requests go to local handshake vendors (~15 per year) and are trivial to copy-paste. It had earlier been reframed from auto-communication to a visibility-only dashboard on 29-May, but is now declined outright. Logged in the report as considered-and-declined.

---

## L1: Website Lead Qualification (form default plus retained chat)

Reframed 2026-05-31 to a structured-form qualification backend; updated 2026-06-04: Jordan warmed to the conversational chat on the 4-Jun call (he liked the chat more than he expected and could see a practical use for it), gated on cost vs. website traffic, and Taylor noted it is multi-channel deployable (email signature, referral intake). Both versions are retained: the structured form is the default shipped path, the conversational chatbot is available via `?v=proposal`.

**Today.** keystoneflex.example contact form posts (name, phone, email, message) to `leasing@keystoneflex.example`; the leasing team chases by email or phone with manual qualification questions; LOI negotiation runs in email/Teams. Speed pressure is real ([Discovery-Jordan 49:45, 50:55, 54:14, 55:12]).

**Demo replaces.** A structured qualification form captures the must-have fields directly (location, square footage, business type, business name, plus an open additional-criteria field); it never asks about budget. The structured form is the default front end and the conversational chat is a retained alternative; this replaces the free-text contact form. The enriched lead lands in the in-app Leasing Team Inbox (replacing the email-to-inbox flow), with a verdict badge, confidence, reasoning, the structured five-field submission view, and the matched-units panel, sorted manual-review first.

**Demo augments.** The qualification engine reads the submission (form fields or chat transcript) through the same KFP fit profile (flex industrial categories; 500-10,000 sqft band; Marisol plus expansion markets) and verdict rubric, returning a verdict / confidence / one-sentence reasoning; the engine is unchanged. A notification fires on every lead.

**Demo new.** Match-to-available-units ranks the prospect's stated need against current vacant inventory (units with no tenant) by submarket and size band, rent-independent, and attaches the matched units to the lead so the Leasing team sees concrete options at first glance.

**Demo does not cover.** The form and chat front ends in production (Keystone builds and hosts its own; this demo provides the qualification backend, a representative form, and a retained chat); the cost vs. website-traffic call on the chat and the multi-channel surfaces Taylor noted (email signature, referral intake); production website integration; real CRM integration; voice callback fulfillment; tour scheduling; LOI negotiation thread automation; a live availability feed (the matcher reads the seeded inventory).

→ Full detail: [`app/chat-leasing/process.md`](../../app/chat-leasing/process.md)

---

## L2: Lease Abstraction (single-lease Yardi-UI path)

Narrowed 2026-05-31 to the single-lease path: one person on the accounting team does the full Yardi create-through-activate sequence, and L2 extracts the fields that sequence needs. Bulk acquisition inheritance is A5's path, not L2's. L2 is the foundation for C3 (with A5).

**Today.** A new lease is signed on an already-owned property, distributed via email; the accounting team reads the lease open in Yardi by hand and types each input field; Jordan estimates 15 minutes per lease "properly done"; abstraction is acknowledged as something KFP should do for every lease but lacks capacity for; errors slip through (abstraction errors can cause billing mistakes that surface only in financial review). Lease distribution to abstraction is a complete GAP in the leasing workflow ([Discovery-Jordan 01:01:29, 01:12:15, 01:13:03, 01:14:26], [Pre-discovery-KFP-initiatives]).

**Demo replaces.** **DocuSign Inbox panel** (visual-only theoretical envelope listener) with a "Simulate signed lease" button that inserts pre-authored fixtures as `source = "docusign"` + `status = "awaiting_review"` abstracts, auto-extracted in seconds; "Upload Lease" runs the dual-path extraction pipeline (text-native via unpdf + Sonnet 4.6 or vision via Opus 4.7 native PDF), auto-routing on page-1 char count and storing `extractionPath` for transparency; structured `LeaseAbstract` JSON produced in 30 to 45 seconds with per-field confidence badges; **review queue** filters the lease list to "Awaiting review" arrivals; **"Approve and push to Yardi"** flips `status = "pushed_to_yardi"` and stamps `pushedToYardiAt`; the existing "Push to Yardi" paste-ready modal shows the Alex rent-roll column mapping.

**Demo augments.** Low-confidence fields surface in a "Needs review" group at the top of the editor; every abstract feeds C3 retrieval via `rawSections` into the FTS5 index synchronously at write time (new abstracts queryable in C3 within seconds).

**Demo new.** Operating-expense recovery extraction (added 2026-06-04): a structured `operatingExpenseRecovery` object (recovery type, base year, method, pro-rata share, expense categories, cap, reconciliation basis) shown in the AbstractEditor "Recoveries" group, mapped in the Yardi paste-ready modal, and captured into `rawSections` so C3 can cite it. Alex's top L2 ask, the most billing-critical Yardi field; stated lease terms only [Validation 2026-06-04]. Narrative panel contrasting current quarterly-lag workflow with demo's same-day flow; "Ask C3 about this lease" deep-link from the abstract editor that auto-fires an opening query in C3; status pills + source tags on the lease list.

**Demo does not cover.** Real DocuSign envelope webhook (button simulates it), real Yardi API push (paste-ready only), operating-expense recovery reconciliation math against budgets (stated terms only; a portfolio / C3 follow-up), bulk acquisition inheritance (that is A5's path, not L2's), lease amendments/addenda, re-extraction after modifications, COI matching, distribution routing across accounting + property mgmt + portfolio reporting.

→ Full detail: [`app/lease-abstraction/process.md`](../../app/lease-abstraction/process.md)

---

## A5: Acquisition Lease Bulk-Load

**Today.** A deal closes and Keystone inherits the seller's in-place leases from the closing rent roll and unit inventory; the accounting team hand-keys each inherited lease into the Yardi UI at acquisition, lease by lease, manually creating the six linked records Yardi needs per occupied lease (lease record, unit cross-reference, unit, square footage history, charge schedule, billing contact); vacant units are set up separately as available-to-rent inventory and are easy to miss; the entry is slow and error-prone ([Rent roll structure], [Discovery-Jordan], [Pre-discovery-KFP-initiatives]).

**Demo replaces.** One bulk emission fans the closing rent roll out into the six linked Yardi commercial ETL tables (CommLeases, CommUnitXrefs, CommUnits, CommSQFTs, CommChargeSchedules, CommContacts) in a single pass via the deterministic fan-out transform, replacing the lease-by-lease hand entry; vacant units are emitted as available-to-rent shells in the same pass (CommUnits + CommSQFTs only), so newly inherited vacancy cannot fall through, replacing the separate miss-prone vacant-unit setup. The worked example is the Foundry deal, a recently closed ~two-dozen-tenant flex park (see the seed data).

**Demo augments.** A bulk-load summary card (leases, occupied units, vacant shells, total SF) and a tabbed six-table preview let the accounting team review the emitted tables instead of typing them.

**Demo new.** The occupied six-table fan-out vs the vacant two-table shells is tagged in the preview so the difference reads at a glance; the inherited leases feed C3 (source `bulk_load`) and the vacant shells feed C3's availability path.

**Demo does not cover.** Live `.xls` ingest of the seller's raw closing rent roll (needs Yardi access; shown as a disabled affordance); the Foundry rent-roll detail was only an attachment reference in the PSA, so rents, unit sizes, dates, and charges are modeled to KFP's flex profile; vacant-shell counts are illustrative (the source property was nearly fully occupied); no write-back to Yardi (the six tables are a review artifact; Yardi stays the read-only system of record).

→ Full detail: [`app/acquisition-bulk-load/process.md`](../../app/acquisition-bulk-load/process.md)

---

## C3: Lease Document Intelligence

**Prerequisite corpus:** C3 queries the lease corpus produced by BOTH L2 (negotiated and form leases) AND A5 (the Foundry inherited leases, source `bulk_load`, plus the vacant unit shells the availability path reads).

**Today.** Property managers, leasing associates, and asset managers pull lease PDFs from email or the shared drive to answer tenant questions about HVAC responsibility, renewal options, expirations, net effective rent; multi-lease comparisons require manual side-by-side review. Jordan named a commercial lease-AI vendor as the desired behavior; KFP evaluated a vendor tool and chose not to proceed ([Discovery-Jordan 01:02:24, 01:04:05], [Pre-discovery-KFP-initiatives]).

**Demo new.** Chat interface over the L2-produced and A5 bulk-loaded lease abstracts, backed by SQLite FTS5 retrieval over `rawSections` with prefix matching (`term*`), stopword filter, and per-lease rebalance (max 2 sections per lease in the pool); **eight FlexOps AI-curated example chips** grounded in Jordan's stated use cases: HVAC responsibility for a tenant, per-property tenant expiration schedule for Foundry, leases expiring next quarter, compare net effective rents, lender consent / loan docs for a tenant, renewal options summary, which leases have free rent in year 1, which leases have TI allowance > $10/sqft; a per-property tenant expiration schedule rendered as a typed block grouped by `propertyAddress`; a loan-document / lender-consent side path that cites the real "Lender Consent and Loan Documents" section on the inherited A5 leases; an availability ("what is empty and rentable") side path that surfaces the A5 vacant shells (`units.tenantName IS NULL`); an operating-expense-recovery side path that surfaces the L2 recovery section; citation chips inline with an "Open in L2" deep-link; comparison queries return inline tables; every citation includes lease id, section heading, page, and exact quote. Richer default outputs (added 2026-06-04): expiration / schedule answers now auto-include unit size and rent per sqft (Size and Rent/SF columns), terse queries return headline rental items by default, and per-property expiration queries surface an anticipated NOI-lift stat (sum of below-market gap x size at rollover, using the A1 market-rent assumptions from `lib/uw-assumptions.ts` so A1 and C3 agree) [Validation 2026-06-04].

**Demo replaces.** Manual lease pull and read; manual side-by-side comparisons; the manual per-property expiration ladder; manual loan-document lookup. Structured side paths: (a) expiration / renewal queries inject a synthetic "Lease Dates (system)" section with the explicit `leaseEnd` date; (b) net-effective-rent queries pull every lease's Free Rent + TI + Base Rent sections so the LLM can compute NER per lease.

**Demo augments.** Cross-link with L2: arriving via `/lease-intelligence?leaseId=X` auto-fires an opening query about that lease.

**Demo does not cover.** Production lease library (seeds from the L2 abstracts plus the A5 bulk-loaded inherited leases only); production loan-document parsing (lender-consent answers come from the seeded section, not real loan agreements); a real Yardi availability feed (the empty-and-rentable units are the A5 vacant shells; vacant counts illustrative); role-based access controls and role-tiered display (a roadmap note per the 4-Jun call, not built); the anticipated NOI-lift as a precise forecast (it is a labeled estimate from the A1 market-rent assumptions); cross-document search beyond leases; persisted query history exposed to users; citations linking to specific PDF pages with overlay highlights.

→ Full detail: [`app/lease-intelligence/process.md`](../../app/lease-intelligence/process.md)

---

## What's NOT covered by any active demo

Rolling up the "what the demo does NOT cover" sections across all five active demos plus the Phase 2 roadmap in `CLAUDE.md`:

**Infrastructure / integration gaps.** Yardi API or import-format integration (L2 paste-ready, A5 six-table ETL artifact; both need a confirmed Yardi import path. L3's standalone item is retired, absorbed by L2 + A5); A5 live `.xls` ingest of the seller's raw closing rent roll (needs Yardi access); production website / form / chat integration (L1); real CRM integration (L1); a live unit-availability feed (L1 matcher and C3 availability path read the seeded inventory); production lease library and role-based access (C3); production loan-document parsing (C3 cites the seeded section); Commercial Cafe tenant portal (out of scope, property management territory); Yardi internal architecture changes (out of scope).

**Workflow steps deferred.** LOI negotiation thread automation (L1, stays in email/Teams); tour scheduling (L1); the L1 conversational-chat cost vs. website-traffic decision and its multi-channel surfaces (warmed to on 4-Jun, both versions retained); lease amendment / addendum extraction (L2); re-extraction after lease modifications (L2); COI matching / insurance verification (L2); operating-expense recovery reconciliation math against budgets (L2 extracts stated terms only); voice callback fulfillment (L1, captured as a preference only); operating-expense add-back normalization for non-NNN leases (A1); the full A1 underwriting model (the yield-on-cost sensitivity table is a first pass pending Alex's written spec, a second underwriting model, and ground-up development models); C3 role-tiered display (a roadmap note per the 4-Jun call).

**Out-of-scope by client request.** Victor presentation automation; Excel underwriting model rebuild (functional, not burdensome per Jordan); development pipeline workflows (deferred to the incoming development lead).

**Phase 2 roadmap (not in current demo build).** L4 Voice Agent (Tenant Prospecting); L5 AR/Delinquency Workflow; L6 Leasing Inbox Enrichment Agent; P1 Portfolio Management Application; P2 Automated Re-underwriting Assistance; P3 Closed-loop Move-out Tracking; A4 Cost Estimating Database; C1 Email Listener for Jordan; C2 AI Meeting Transcription (off-the-shelf recommendation, no custom build). (L3 Yardi Data Entry Automation was retired as a standalone item on 2026-05-31; its single-lease path is absorbed by L2, its bulk path by A5, and the 5+ hrs/week pain point is kept as justification for both.)

**New solution tracks from the 4-Jun validation session (scoping / report, not in the demo build).** Portfolio Absorption Reporting (authorized by Jordan; standalone; Alex co-designs the output; dedicated working session); Historical Operating Performance Reporting (qualify; overlaps P1; file under in-person review by Alex and Sam); Website-to-Yardi Vacancy Sync (low priority, report item; owner to consult: the website owner).

**Declined / removed from active build.** A3 Property Onboarding declined by Jordan on 2026-06-04 and removed entirely (the deal process is human-owned and unpredictable; the checklist is an aid, not the driver; financing is a separate relationship-driven team; DD RFPs go to ~15/yr local handshake vendors). A2 Voice Agent for Acquisition Cold Calling removed 2026-05-26; reference materials kept internally; production resumption gated on TCPA legal review.
