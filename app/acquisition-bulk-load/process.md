# A5 Acquisition Lease Bulk-Load: Current vs Demo Process

## Current Process (what KFP does today)

1. A deal closes and Keystone inherits the seller's in-place leases from the closing rent roll and unit inventory delivered with the transaction [Rent roll structure].
2. The Accounting team hand-keys each inherited lease into the Yardi UI at acquisition, lease by lease, one screen at a time [Discovery-Jordan, Pre-discovery-KFP-initiatives].
3. For each occupied lease the team manually creates the linked records Yardi needs: the lease record, the unit cross-reference, the unit, the square footage history, the charge schedule, and the billing contact. These map to the six Yardi commercial ETL tables (CommLeases, CommUnitXrefs, CommUnits, CommSQFTs, CommChargeSchedules, CommContacts) seen in a reference property's Yardi export and the Foundry PSA [Rent roll structure].
4. Vacant units at acquisition have to be set up separately as available-to-rent inventory; because they are entered by hand they are easy to miss, so newly inherited vacancy can go unlisted [Discovery-Jordan].
5. The entry is slow and error-prone: a single mistyped rent, date, or unit code propagates into accounting and reporting [Pre-discovery-KFP-initiatives].

## Demo Process (what this solution does)

1. The Acquisitions team selects the closing rent roll for a freshly closed deal on `/acquisition-bulk-load`; the worked example is the Foundry deal (a recently closed ~two-dozen-tenant flex park; occupied leases plus a few vacant units). **(augments)** Current step 1's manual handoff of the closing rent roll.
2. One bulk emission fans the closing rent roll out into the six linked Yardi commercial ETL tables in a single pass via the deterministic fan-out transform. **(new)** Replaces the lease-by-lease hand entry of current steps 2 and 3 with a single bulk load.
3. Occupied units fan out across all six tables (one CommLeases, one CommUnitXrefs and one CommUnits and one CommSQFTs per unit, one CommChargeSchedules per charge, one billing CommContacts), while vacant units land as CommUnits plus CommSQFTs shells only, available to rent. The occupied 6-table fan-out vs vacant two-table shells is tagged in the preview so the difference reads at a glance. **(new)** No current equivalent; the demo makes the occupied-vs-vacant distinction explicit and consistent.
4. Vacant units are emitted as available-to-rent shells in the same pass, so newly inherited vacancy cannot fall through. **(replaces)** Current step 4's separate, miss-prone vacant-unit setup.
5. A single bulk-load summary card shows the counts (leases, occupied units, vacant shells, total SF) and a tabbed six-table preview shows each table's row count and a readable sample so the Accounting team reviews the emitted tables instead of typing them. **(augments)** Current step 5's manual entry and self-check.
6. Live ingestion of the seller's raw closing .xls is shown as a clearly-disabled affordance labeled "needs Yardi access". Out of scope this round.

## Mapping

| Current Step | Demo Step | Relationship | Notes |
| --- | --- | --- | --- |
| 1 (inherit closing rent roll) | 1 (select closing rent roll) | augments | Demo selects the worked example; live .xls ingest is out of scope |
| 2 (hand-key each lease into Yardi) | 2 (single bulk emission) | replaces | Lease-by-lease entry becomes one bulk load |
| 3 (manually create six linked records per lease) | 2, 3 (six-table fan-out) | replaces | Occupied units fan out across all six tables automatically |
| 4 (separate vacant-unit setup, miss-prone) | 4 (vacant shells in same pass) | replaces | Vacant units land as CommUnits plus CommSQFTs shells, available to rent |
| 5 (manual entry, error-prone) | 5 (summary plus six-table preview) | augments | Team reviews emitted tables instead of typing them |
| new: occupied vs vacant tagging | 3 (fan-out vs shell legend) | new | Occupied 6-table fan-out vs vacant two-table shells made explicit |

## What the demo does NOT cover

- Live .xls ingest of the seller's raw closing rent roll: it needs Yardi access and is shown as a disabled "needs Yardi access" affordance.
- The Foundry rent-roll detail was only an attachment reference in the PSA, so the per-lease rents, unit sizes, dates, and charges are modeled to KFP's flex profile rather than transcribed from a schedule. Tenant names, security deposits, and unpaid leasing costs are patterned on the PSA tenant schedule (names fictionalized and amounts perturbed in this public version).
- Vacant-shell counts are illustrative: the source property was nearly fully occupied, so the vacant units shown are a representative stand-in to demonstrate the shell fan-out, not the true vacancy.
- No write-back to Yardi: the demo emits the six ETL tables for review only. Yardi stays the read-only system of record; production loading needs a confirmed Yardi import path.
