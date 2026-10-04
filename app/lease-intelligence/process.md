# C3 Lease Document Intelligence: Current vs Demo Process

## Current Process (what KFP does today)

1. Property managers, leasing associates, and asset managers field tenant questions about lease terms (HVAC responsibility, who pays for what, expiration, renewal options).
2. To answer, the team pulls the lease PDF from email or the shared drive and reads the relevant section by hand.
3. Multi-lease comparisons (for example, net effective rent across negotiated leases) require manual side-by-side review of multiple PDFs.
4. Jordan explicitly named the a commercial lease-AI vendor product as an example of the desired behavior: ask a question, get an answer with citation, run net-effective-rent comparisons across leases [Discovery-Jordan 01:02:24, 01:04:05].
5. KFP evaluated a vendor tool and chose not to proceed, but kept the use case as a priority [Discovery-Jordan 01:04:05].
6. Pre-discovery: lease terms, portfolio records, and operational documents are hard to search [Pre-discovery-KFP-initiatives].

**Prerequisite corpus:** C3 queries the lease corpus produced by BOTH L2 (single-lease abstraction; the negotiated and form leases) AND A5 (Acquisition Lease Bulk-Load; the seller's in-place leases inherited at the Foundry closing, plus the vacant unit shells). L2 supplies the negotiated-lease detail; A5 supplies the bulk-loaded inherited leases (source `bulk_load`) and the empty-and-rentable units that the availability path reads.

## Demo Process (what this solution does)

1. Chat interface over the L2-produced and A5 bulk-loaded lease abstracts, backed by SQLite FTS5 retrieval over `rawSections`. FTS query uses prefix matching (`term*`) and a stopword filter so "rents" matches "rent" and common words like "tenant"/"lease" don't dominate scoring. **(new)**
2. Suggested-query chips for eight FlexOps AI-curated example prompts grounded in Jordan's stated use cases (not a verbatim client list): HVAC responsibility for a tenant; per-property tenant expiration schedule for the Foundry property; leases expiring next quarter; compare net effective rents across the negotiated leases; lender consent / loan docs for a tenant; renewal options summary across the portfolio; which leases have free rent in year 1; which leases have TI allowance over $10 per square foot. **(new)**
3. Citation chips inline in every assistant message; click expands the source lease section in the right pane and adds an "Open in L2" deep-link button. **(new)**
4. Structured side-paths for the cross-lease query classes: (a) expiration / renewal queries inject a synthetic "Lease Dates (system)" section with the explicit `leaseEnd` date so the LLM has a concrete date to cite; (b) net-effective-rent queries pull every lease's Free Rent + TI Allowance + Base Rent sections from `rawSections` so the LLM can compute NER per lease. **(replaces)** Current step 3's manual review for both use cases.
5. Per-property tenant expiration schedule as a structured artifact: when the query names a property and asks for expirations, the retrieval layer groups that property's leases by `propertyAddress` and surfaces a grouped "Expiration Schedule (system)" section, and the model fills a typed `schedule` array (propertyAddress, tenant, suite, leaseEnd, daysToExpiry, renewalOption, plus `sizeSqft` and `rentPerSqft`) that the chat UI renders as a dedicated schedule block distinct from the freeform comparison table. **(new)**
5a. Size + rent/sqft included by default: every per-property expiration / schedule row now carries unit size and rent per sqft beside the dates (Size and Rent/SF columns), so Alex does not have to ask a second question; and terse queries (e.g., just a property name) return the headline rental items (tenant, suite, size, rent/sqft, lease end, renewal) by default rather than asking the user to narrow. Alex asked for more on first look and a fuller default response [Validation 2026-06-04]. **(new)**
5b. Anticipated NOI-lift layer: per-property expiration queries surface a headline anticipated-NOI-lift stat, computed as the sum over leases expiring in the window of `max(0, marketRentPsf(submarket) - inPlaceRentPsf) x sizeSqft`. `marketRentPsf` comes from `lib/uw-assumptions.ts`, the same A1 market-rent assumptions, so A1 and C3 agree. It is a clearly-labeled estimate (market-rent assumptions, not signed comps). Alex asked for an anticipated NOI lift derived from the expiration schedule [Validation 2026-06-04]. **(new)**
6. Loan-document / lender-consent handling: a `mentionsLoanDocs` classifier (anchored to lender consent / loan doc / mortgage / deed of trust / estoppel / SNDA / subordination / non-disturbance / attornment vocabulary, so it does not collide with the net-effective-rent or expiration classifiers) fires a side-path that surfaces the real "Lender Consent and Loan Documents" `rawSections` on the inherited (A5 bulk_load) leases, so citations are clickable and resolve to a real section, not a synthetic page-0 row. **(new)**
7. Availability ("what is empty and rentable"): an availability-intent classifier fires a units-aware side-path that queries vacant units (`units.tenantName IS NULL`) joined to properties, narrowed to the named property, and injects them as "Available Unit (system)" answer context. These are the A5 vacant shells; the result shape is kept distinct from lease sections so the citation list does not mix shapes. **(new)**
8. Per-lease rebalance on FTS results: at most 2 sections per lease in the retrieved pool so a single tenant doesn't crowd out the rest. **(new)**
9. Comparison queries return a markdown-style table the chat UI renders inline. **(replaces)** Current step 3's manual side-by-side.
10. Every citation includes lease id, section heading, page, and exact quote; never hallucinated outside provided context. **(new)**
11. Cross-link with L2: arriving via `/lease-intelligence?leaseId=X` auto-fires an opening query about that lease; citation panel surfaces an "Open in L2" link back to the abstract editor. **(new)**

## Mapping

| Current Step | Demo Step | Relationship | Notes |
| --- | --- | --- | --- |
| 1 (tenant questions inbound) | trigger | n/a | C3 answers them on demand |
| 2 (manual lease pull and read) | 1+3+10 (chat + citations) | replaces | The core time saving |
| 3 (manual comparisons) | 4+9 (structured side path + table) | replaces | Comparisons are now one-shot (expiration ladder + NER) |
| 3 (manual per-property ladder) | 5 (structured schedule block) | replaces | The per-property expiration schedule is a typed artifact, not a hand-built spreadsheet |
| new: richer first-look output | 5a (size + rent/sqft by default) | new | Size and rent/sqft accompany every schedule row; terse queries still return headline items [Validation 2026-06-04] |
| new: anticipated NOI lift | 5b (NOI-lift stat) | new | Sum of below-market gap x size at rollover, using the A1 market-rent assumptions so A1 and C3 agree [Validation 2026-06-04] |
| 2 (manual loan-doc lookup) | 6 (loan-doc side path) | replaces | Lender consent / SNDA answers cite the real inherited-lease section |
| n/a (no current "what's empty" view in the lease tool) | 7 (availability side path) | new | Reads the A5 vacant shells; answers empty-and-rentable from the same chat |
| 4 (a commercial lease-AI vendor use case) | full demo | replaces | The capability Jordan wanted, in-house |
| 5 (vendor tool not pursued) | n/a | n/a | Context, not a step |
| 6 (general search difficulty) | 1 (FTS retrieval with prefix + stopwords) | replaces | Pre-discovery friction directly addressed |
| cross-demo handoff | 11 (deep-link with L2) | new | Citation to Open in L2; L2 abstract to Ask C3 |
| cross-demo corpus | prerequisite (L2 + A5) | new | A5 supplies the inherited bulk_load leases and the vacant shells C3 queries |

## What the demo does NOT cover

- Production lease library (demo seeds from the L2 abstracts plus the A5 bulk-loaded inherited leases only).
- Production loan-document parsing: the lender consent / loan-doc answers are sourced from the seeded "Lender Consent and Loan Documents" abstract section on the inherited leases, not from parsing real loan agreements, SNDAs, or estoppel certificates.
- Real Yardi availability feed: the empty-and-rentable units are the A5-seeded vacant shells (`units.tenantName IS NULL`), not a live Yardi vacancy feed; vacant counts are illustrative (the source property was nearly fully occupied).
- Role-based access controls (everyone on the deployed app sees all leases). Role-tiered display (showing different default outputs by viewer role) is a roadmap note only per the 4-Jun call, a dev-config decision, not built [Validation 2026-06-04].
- NOI-lift as a precise forecast: the anticipated NOI-lift stat is a labeled estimate from the A1 market-rent assumptions, not a signed-comp projection or an underwriting model.
- Cross-document search beyond leases (portfolio records, operational docs deferred).
- Persisted query history exposed to users (logged in `queryLog` but not surfaced).
- Citations linking to specific PDF pages with overlay highlights (citation card shows the extracted text excerpt only).
