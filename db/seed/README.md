# db/seed: Seed Data Strategy

Demo seed data is **synthetic or fictionalized, and built programmatically**. Each seed module (`properties.ts`, `units.ts`, `lease-abstracts.ts`, `oms.ts`, `acquisition-bulk.ts`, `leads.ts`) generates KFP-profile data deterministically via `_data.ts` so the seeded baseline is identical on every run. `index.ts` wires them together, wipes tables in FK-safe order, then inserts.

**Run with `pnpm db:seed`.** This first executes `scripts/verify-fixtures.ts`, then runs `tsx db/seed/index.ts`. `pnpm db:reset` is the full local re-baseline (drop SQLite file + re-migrate + re-seed).

## Why no PDFs in this directory

Per the de-duplication policy in `docs/reference/file-layout-deep.md`, client source documents were never copied into the repo. During the engagement they lived in a gitignored client-materials folder next to the repo and were **referenced**, not duplicated. They are not part of this public version.

The seed never parses those files at seed time. Where a demo needed real-document structure, the document was extracted once (via `scripts/pre-extract.ts`) into JSON under `db/seed/extracted/`, and that JSON was then fictionalized (names, addresses, and figures replaced or perturbed) before being committed:

| Committed JSON | Used by | Derived from |
| --- | --- | --- |
| `extracted/crestview.json`, `extracted/uptown.json`, `extracted/meridian.json` | A1 (OM ingestion baseline) | Three broker offering memoranda |
| `extracted/keystone-lease.json` | L2 (text-native path) | KFP form lease sample |
| `extracted/legacy-lease.json` | L2 (vision path) | Scanned legacy lease sample |
| `extracted/acquisition-bulk-foundry.json` | A5 (bulk-load worked example) | A closing PSA tenant schedule, modeled onto a reference Yardi six-table ETL export |

Other client files served only as format references: the 54-column rent roll data-structure workbook (A1 columns), a populated rent roll (the built-out MG $27-30/sqft band), the six Yardi commercial ETL exports (A5's emitted table shape), and cold call notes (the retired A2 script).

The Foundry closing rent roll in `acquisition-bulk-foundry.json` carries a tenant roster and security deposits patterned on a PSA schedule (fictional names, perturbed amounts); unit sizes, rents, and dates are modeled. `db/seed/acquisition-bulk.ts` loads it.

## Reference pattern for any future seed-time PDF loader

```typescript
import path from "node:path";

// Point at a local, gitignored folder of sample documents.
const CLIENT_ROOT = process.env.CLIENT_MATERIALS_DIR ?? path.resolve(__dirname, "../../../");
const LEASE_FORM_PDF = path.join(CLIENT_ROOT, "sample-form-lease.pdf");
const LEASE_LEGACY_PDF = path.join(CLIENT_ROOT, "sample-legacy-lease.pdf");
const OM_SAMPLE = path.join(CLIENT_ROOT, "sample-om.pdf");
```

Do not duplicate source files into `db/seed/*-fixtures/` directories that get committed.

## When the source folder is unreachable

In a deployed container the client-materials folder is not present. `scripts/verify-fixtures.ts` detects this and warns (exits 0) rather than failing the seed, so the deployed demo still seeds cleanly from the committed JSON. The runtime upload affordances surface a "fixture missing" toast if a presenter tries to load a sample PDF that isn't shipped; any public CRE PDF works as a substitute for live upload.
