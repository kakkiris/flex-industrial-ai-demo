# Data Model

Drizzle ORM over `better-sqlite3`. Single SQLite database at `db/kfp-demo.db` (gitignored). 13 typed tables plus one FTS5 virtual table. Schema source of truth: `db/schema.ts`. Migrations under `db/migrations/`. The FTS5 virtual table is created by `db/migrate.ts` directly because Drizzle does not model virtual tables.

## Tables, grouped by demo

### Shared across all demos
- `properties`, buildings being tracked. Sources: internal, OM ingestion, CoStar.
- `units`, leasable units within a property. The columns mirror the 54-column KFP rent roll structure delivered by Alex ([Rent roll structure]).
- `source_documents`, raw PDFs (OMs, leases, PSAs) keyed by type and path.
- `notifications`, in-app notification feed for the top-bar bell.
- `query_log`, every LLM Q&A round-trip (used by C3 and shared retrieval).

### A1 Market Intelligence
- `properties`, `units` carry the searchable rent roll.
- `comp_confidence`, per-unit confidence metadata: `rent_confidence` (`high`/`medium`/`low`), `source_type` (`signed_lease` | `om_rent_roll` | `costar_estimate`), `raw_quote`, `extracted_from_page`. Drives the badge color and tooltip on every comp row.

### A3 Onboarding Orchestration
- `deals`, one per acquisition; `psa_path`, `psa_signed_at`, `deposit_due_at`, `dd_end_at`, `closing_at`, `status`, plus `extracted_summary` JSON for the LLM's PSA extraction output.
- `onboarding_tasks`, DD and onboarding work items with `task_type` enums (`deposit`, `rfp_pca`, `rfp_env`, `rfp_survey`, `rfp_title`, `coi_receipt`), `due_at`, `status`, optional `blocker`.
- `rfp_drafts`, AI-generated RFP drafts by `vendor_type` (`pca`, `environmental`, `survey`, `title`).

### L1 Website Chat
- `leads`, three-tier qualifier output. Restructured 2026-05-27 to drop `budgetRange` (not in Jordan's stated criteria; the qualifier explicitly never asks about budget per `lib/prompts/leasing-chat.ts`) and add Tier 2 (`timeline`, `lease_term_years`) + Tier 3 (`existing_locations`, `motivation`, `loading_needs`) fields. `tier_map` is a JSON column annotating which tier each captured field came from.
- `chat_sessions`, chat session metadata plus `transcript` JSON for the L1 inbox detail drawer.

### L2 Lease Abstraction
- `leases`, uploaded lease PDFs.
- `lease_abstracts`, structured abstracts. Several JSON columns: `base_rent_schedule`, `escalations`, `renewal_options`, `cam_terms`, `special_provisions`, `extraction_confidence`, `raw_sections`. The `extraction_path` text column records whether the row came from the text or vision path for transparency (added per the 2026-05-27 L2 dual-path update).

### C3 Lease Intelligence
- Reuses `lease_abstracts.raw_sections` JSON (an array of `{ section, page, text }` objects per lease).
- `lease_sections_fts`, FTS5 virtual table created by `db/migrate.ts`. Columns: `lease_id`, `section`, `page UNINDEXED`, `text`. Seeded from `raw_sections` so C3 can do keyword + phrase search across all leases' sections.

## Why JSON columns

Several fields are stored as JSON text rather than child tables. The reasons are pragmatic for a demo:

- **Rent schedules, escalations, renewal options, CAM terms**, variable-shape, lease-specific, never queried as columns. Consumers parse them in TypeScript on the read path. Splitting them into child tables would add joins for no win in the demo's query patterns.
- **`extraction_confidence`**, per-field confidence map. Shape matches the abstract's fields; treating it as a sidecar JSON keeps the abstract row a single source of truth and simplifies the L2 review UI.
- **`raw_sections`**, kept as JSON in `lease_abstracts` for write simplicity; mirrored into the FTS5 virtual table for read-side retrieval.
- **`tier_map` on leads**, annotation only; never queried as a column.

For a production rebuild, the rent schedule, escalations, and rawSections would likely become first-class tables.

## Fields populated only where the integrated solutions provide source data

Two `units` columns are deliberately sparse in seeded data:

- **`tenant_category`**, populated by L1 when a new prospect's business type is captured during the chat qualifier ([Discovery-Jordan], 2026-05-27 update note). Empty for legacy units acquired before L1 existed; the A1 dashboard surfaces a "pending capture" badge for those.
- **`clear_height_ft`** (on `properties`), populated by A1 when an OM is ingested. Empty for legacy properties acquired without an OM in the system.

These are not bugs; they are explicit demo affordances showing reviewers which units have which data populated and where backfill would be needed for production.

## Pre/post-acquisition split

Alex tracks performance differently for what was inherited at acquisition vs what was signed under KFP ownership ([Discovery-Alex 04:46], [Discovery-Alex 08:00]). The `units` table mirrors this with paired columns: `legacy_rent` / `kfp_rent`, `legacy_term_years` / `kfp_term_years`, `legacy_sf` / `kfp_sf`. The A1 dashboard can filter or contrast on these dimensions.

## Underwriting comparison columns

`rent_uw`, `trended_rent_at_lease`, `performance_to_uw`, `leased_impact_uw`, `vacancy_impact_uw`, `combined_impact_uw` are nullable. The seeded KFP-profile portfolio leaves them empty by default; they light up when real UW models are loaded (Taylor P1 ask #3).

## Tables intentionally absent

- No `callTargets` / `callOutcomes`, A2 (Voice Agent) was removed from the active build; tables were dropped from the schema in the same pass.
- No `users` or `roles`, the demo runs as a single presenter; production would add role-based access.
- No Yardi sync tables, Yardi is treated as read-only system of record. The L2 "push to Yardi" is paste-ready output only, no integration.
