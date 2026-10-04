# KFP AI Audit Demo Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single Next.js application at `localhost:3000` with sidebar navigation across six KFP AI audit demos (A1 Market Intelligence Dashboard, A2 Voice Agent, A3 Onboarding Orchestration, L1 Website Chat, L2 Lease Abstraction, C3 Lease Intelligence) plus a Home tab, satisfying every acceptance criterion in `solution_builds.md` section 3.

**Update 2026-05-26:** Demo A2 (Voice Agent) dropped at user direction. Tasks 15, 16, 17 marked deleted; A2 infrastructure removed in a cleanup commit. The build now ships five demos: A1, A3, L1, L2, C3.

**Architecture:** Next.js 15 App Router monolith with a shared shadcn/ui shell, one shared SQLite/Drizzle database, one shared Anthropic SDK client, and one shared PDF extraction pipeline serving all six demos. Each demo lives at its own route under `app/` and writes to common tables (properties, units, leases, abstracts, leads, deals, etc.). Vapi powers the A2 voice loop via webhook. C3 reads from the same `leaseAbstracts` rows L2 writes.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript strict, Tailwind v4, shadcn/ui, Drizzle ORM, better-sqlite3, `@anthropic-ai/sdk` (Sonnet 4.6 default, Opus 4.7 for lease extraction, Haiku 4.5 for classifiers), unpdf + Anthropic vision for PDF, zod for LLM output validation, TanStack Query for client data, Vapi.ai SDK for A2, Vitest for tests, pnpm.

---

## Open Decisions (need user input before or during execution)

These are decisions where the spec is intentionally open. Answers shape implementation. Defaults shown in **bold**; flag in the kickoff message if any default is wrong.

1. **Working directory.** Scaffold the Next.js app directly at the repo root (alongside `CLAUDE.md`, `solution_builds.md`) **rather than** in a `kfp-demo-suite/` subfolder. Keeps the docs at app root, matches the spec's repo structure.
2. **Anthropic API key.** Required for every demo. User provides `ANTHROPIC_API_KEY` in `.env.local`. No fallback.
3. **Vapi account + key + phone number ID.** Required for A2 only. If unavailable at build time, A2 ships with a "simulated call" mode (canned transcript playback) and a flag swap once credentials land. **Plan ships both modes**; live mode activates when `VAPI_API_KEY` is present.
4. **Voice demo target phone number.** A2 dials a real phone for the live demo. **Default: the presenter enters their own cell in a UI input at call time** (not stored in env, not committed).
5. **Hot lead and qualified lead notification destination.** Spec says "Slack/email" with console fallback. **Default: in-app toast + write to a `notifications` table viewable from a "Notifications" bell in the top bar.** Optional Slack webhook via `SLACK_WEBHOOK_URL` env if user provides one.
6. **OM, PSA, and lease fixture sourcing.** Spec says "publicly-sourced." **Default: I curate 5 OMs, 1 PSA template, 2 leases from public CRE sources at seed time and commit them to `db/seed/{om,psa,lease}-fixtures/`.** User can replace any of them in `/uploads/` for the live walkthrough.
7. **Embedding/retrieval strategy for C3.** Spec offers hnswlib OR FTS5. **Default: SQLite FTS5 over abstract JSON + lease section text.** Zero extra deps, fast for 5-10 leases. If retrieval quality is weak in testing, escalate to Voyage AI embeddings + in-memory cosine.
8. **Yardi paste-ready output format for L2.** No real Yardi schema published. **Default: a flat key-value table mirroring the `leaseAbstracts` columns plus a copy-to-clipboard button.** The accounting team's actual Yardi screen shape is a P1 follow-up.
9. **Brand styling for the shell.** Demo is a FlexOps AI deliverable shown to KFP. **Default: FlexOps AI brand (brand indigo `#4F46E5` accent, white background, near-black text, system sans-serif font stack).** Each demo route uses the same shell.
10. **Test scope.** **Default: Vitest for unit tests on zod schemas, prompt builders, confidence helpers, and API route happy paths.** No Playwright/E2E. Acceptance criteria from spec section 3 verified manually via the runbook in section 4.
11. **PDF processing primary path.** Spec lists "unpdf for text, Claude vision for tables/scanned." **Default: try Anthropic's native PDF document support first (Sonnet 4.6 accepts PDFs directly), fall back to unpdf-extracted text for token economy when the doc is text-only.** Vision-via-image-conversion only if a PDF flunks both paths.
12. **Authentication.** Demo is local-only. **Default: none.** Single-user, single-machine.

If any default needs to change, raise it before that demo's tasks start. Otherwise proceed.

---

## Credentials and Accounts Needed From User

| Item | Required for | When needed |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | every demo | before Group 1 (foundations) |
| `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` | A2 only | before A2 task block in Group 2 |
| A real cell phone for live test call | A2 demo walkthrough | demo day only (entered in UI, not stored) |
| `SLACK_WEBHOOK_URL` (optional) | A2 hot-lead notify, L1 lead notify | optional; degrades to in-app toast if absent |

No GitHub, no Vercel, no DocuSign, no Yardi credentials needed for this build.

---

## File Structure

```
./
├── CLAUDE.md                          # existing
├── solution_builds.md                 # existing
├── README.md                          # existing (updated in Task 1)
├── package.json                       # created
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── drizzle.config.ts
├── vitest.config.ts
├── .env.local.example                 # template, commits
├── .env.local                         # gitignored, real keys
├── .gitignore                         # updated
├── components.json                    # shadcn config
├── db/
│   ├── schema.ts                      # all Drizzle tables
│   ├── client.ts                      # better-sqlite3 + drizzle handle
│   ├── migrate.ts                     # apply migrations
│   ├── seed/
│   │   ├── index.ts                   # seed orchestrator
│   │   ├── properties.ts
│   │   ├── units.ts
│   │   ├── leases.ts
│   │   ├── lease-abstracts.ts
│   │   ├── deals.ts
│   │   ├── call-targets.ts
│   │   ├── om-fixtures/               # 5 public OM PDFs
│   │   ├── psa-fixtures/              # 1 public PSA PDF
│   │   └── lease-fixtures/            # 2 public lease PDFs
│   └── kfp-demo.db                   # gitignored
├── lib/
│   ├── anthropic.ts                   # configured SDK + log wrapper
│   ├── pdf.ts                         # extract text/vision pipeline
│   ├── confidence.ts                  # scoring helpers + types
│   ├── ids.ts                         # nanoid helper
│   ├── env.ts                         # zod-validated env loader
│   ├── notify.ts                      # Slack/in-app dispatch
│   └── prompts/
│       ├── extract-om.ts
│       ├── extract-lease.ts
│       ├── extract-psa.ts
│       ├── draft-rfp.ts
│       ├── voice-script.ts
│       ├── classify-call.ts
│       ├── leasing-chat.ts
│       ├── extract-lead.ts
│       └── lease-intelligence.ts
├── app/
│   ├── layout.tsx                     # shell: sidebar + top bar
│   ├── providers.tsx                  # TanStack Query + toast
│   ├── globals.css                    # Tailwind + brand tokens
│   ├── page.tsx                       # Home: KFP context + status grid
│   ├── market-intelligence/page.tsx   # A1
│   ├── voice-agent/page.tsx           # A2
│   ├── onboarding/page.tsx            # A3
│   ├── chat-leasing/page.tsx          # L1
│   ├── lease-abstraction/page.tsx     # L2
│   ├── lease-intelligence/page.tsx    # C3
│   └── api/
│       ├── ingest-om/route.ts                 # A1
│       ├── search-comps/route.ts              # A1
│       ├── properties/[id]/units/route.ts     # A1
│       ├── voice/start/route.ts               # A2
│       ├── voice/webhook/route.ts             # A2
│       ├── voice/targets/route.ts             # A2
│       ├── onboarding/extract-psa/route.ts    # A3
│       ├── onboarding/draft-rfp/route.ts      # A3
│       ├── onboarding/deals/route.ts          # A3
│       ├── onboarding/blockers/route.ts       # A3
│       ├── chat/leasing/route.ts              # L1
│       ├── chat/leasing/complete/route.ts     # L1
│       ├── leads/route.ts                     # L1
│       ├── lease/extract/route.ts             # L2
│       ├── lease/[id]/abstract/route.ts       # L2
│       ├── lease/intelligence/route.ts        # C3
│       └── lease/[id]/section/[section]/route.ts # C3
├── components/
│   ├── shell/Sidebar.tsx
│   ├── shell/TopBar.tsx
│   ├── shell/StatusGrid.tsx           # Home page demo status cards
│   ├── shared/PDFUploader.tsx
│   ├── shared/PDFViewer.tsx
│   ├── shared/ConfidenceBadge.tsx
│   ├── shared/CitationCard.tsx
│   ├── shared/StreamingResponse.tsx
│   ├── shared/EmptyState.tsx
│   ├── shared/Toast.tsx
│   ├── a1/FilterSidebar.tsx
│   ├── a1/CompsTable.tsx
│   ├── a1/CompDetailPanel.tsx
│   ├── a2/TargetList.tsx
│   ├── a2/LiveCallPanel.tsx
│   ├── a2/OutcomeDashboard.tsx
│   ├── a3/DealList.tsx
│   ├── a3/DealTimeline.tsx
│   ├── a3/RFPDraftTabs.tsx
│   ├── a3/BlockerView.tsx
│   ├── l1/KeystoneMockSite.tsx
│   ├── l1/ChatWidget.tsx
│   ├── l1/LeadInbox.tsx
│   ├── l2/LeaseList.tsx
│   ├── l2/AbstractEditor.tsx
│   ├── l2/PushToYardiModal.tsx
│   ├── c3/ChatInterface.tsx
│   └── c3/SuggestedQueries.tsx
├── tests/
│   ├── prompts/                       # prompt builder unit tests
│   ├── lib/                           # confidence, pdf, env tests
│   ├── api/                           # route happy-path tests
│   └── fixtures/                      # tiny test PDFs and JSON
├── uploads/                           # runtime PDF storage, gitignored
└── docs/superpowers/plans/2026-05-26-kfp-demo-suite.md   # this file
```

---

# Group 1: Foundations

Must complete before any demo build starts. Sequential within the group, but tasks 2-4 can parallelize after task 1.

## Task 1: Scaffold Next.js app, install dependencies, configure tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `.gitignore`, `.env.local.example`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Scaffold Next.js 15 in current directory.** From the repo root, run:

```bash
pnpm create next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*" --no-turbopack --use-pnpm
```

When prompted about non-empty directory, confirm. Expected: a working scaffold with `app/`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`.

- [ ] **Step 2: Install runtime dependencies.**

```bash
pnpm add @anthropic-ai/sdk drizzle-orm better-sqlite3 zod @tanstack/react-query nanoid unpdf lucide-react clsx tailwind-merge class-variance-authority @radix-ui/react-slot
pnpm add -D drizzle-kit @types/better-sqlite3 vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom tsx
```

If Vapi has an official Node SDK at install time, also `pnpm add @vapi-ai/server-sdk`. Otherwise call Vapi REST directly via `fetch`.

- [ ] **Step 3: Initialize shadcn/ui and add components.**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add sidebar card dialog table button input tabs toast badge separator scroll-area textarea select slider checkbox label sheet skeleton
```

- [ ] **Step 4: Replace `app/globals.css` with brand tokens.**

Append the FlexOps AI brand palette on top of the shadcn defaults:

```css
@layer base {
  :root {
    --brand-indigo: 243 75% 59%;            /* #4F46E5 */
    --brand-indigo-dark: 243 55% 49%;       /* #4338CA */
    --brand-black: 0 0% 0%;
    --brand-gray-light: 0 0% 85%;
    --background: 0 0% 100%;
    --foreground: 0 0% 7%;
    --primary: var(--brand-indigo);
    --primary-foreground: 0 0% 100%;
    --radius: 0.5rem;
  }
  .dark { /* keep shadcn defaults */ }
  body { font-family: var(--font-sans, system-ui, sans-serif); }
}
```

- [ ] **Step 5: Update `.gitignore`** to add:

```
# KFP demo suite
.env.local
db/kfp-demo.db
db/kfp-demo.db-journal
uploads/
.next/
node_modules/
coverage/
*.tsbuildinfo
```

- [ ] **Step 6: Create `.env.local.example`:**

```
ANTHROPIC_API_KEY=sk-ant-...
VAPI_API_KEY=
VAPI_PHONE_NUMBER_ID=
DATABASE_URL=file:./db/kfp-demo.db
SLACK_WEBHOOK_URL=
NEXT_PUBLIC_APP_NAME=KFP Demo Suite
```

- [ ] **Step 7: Configure Vitest** in `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Create `tests/setup.ts` with `import "@testing-library/jest-dom/vitest";`.

- [ ] **Step 8: Add npm scripts** to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx db/migrate.ts",
    "db:seed": "tsx db/seed/index.ts",
    "db:reset": "rm -f db/kfp-demo.db && pnpm db:migrate && pnpm db:seed"
  }
}
```

- [ ] **Step 9: Verify build.** Run `pnpm build`. Expected: succeeds.
- [ ] **Step 10: Commit.**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with shadcn, drizzle, vitest, brand tokens"
```

---

## Task 2: Shared infrastructure — env loader, ID helper, logger

**Files:**
- Create: `lib/env.ts`, `lib/ids.ts`, `tests/lib/env.test.ts`

- [ ] **Step 1: Write failing test** at `tests/lib/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadEnv } from "@/lib/env";

describe("loadEnv", () => {
  it("requires ANTHROPIC_API_KEY", () => {
    expect(() => loadEnv({})).toThrow(/ANTHROPIC_API_KEY/);
  });
  it("returns defaults for optional keys", () => {
    const env = loadEnv({ ANTHROPIC_API_KEY: "sk-test" });
    expect(env.DATABASE_URL).toBe("file:./db/kfp-demo.db");
    expect(env.VAPI_API_KEY).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement `lib/env.ts`:**

```ts
import { z } from "zod";

const Env = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY required"),
  VAPI_API_KEY: z.string().optional(),
  VAPI_PHONE_NUMBER_ID: z.string().optional(),
  DATABASE_URL: z.string().default("file:./db/kfp-demo.db"),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("KFP Demo Suite"),
});

export type AppEnv = z.infer<typeof Env>;

export function loadEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): AppEnv {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid env: ${msg}`);
  }
  return parsed.data;
}

let cached: AppEnv | null = null;
export function env(): AppEnv {
  if (!cached) cached = loadEnv();
  return cached;
}
```

- [ ] **Step 3: Implement `lib/ids.ts`:**

```ts
import { customAlphabet } from "nanoid";
const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
export const id = (prefix: string) => `${prefix}_${nano()}`;
```

- [ ] **Step 4: Run tests.** `pnpm test tests/lib/env.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/env.ts lib/ids.ts tests/lib/env.test.ts tests/setup.ts
git commit -m "feat(lib): env loader with zod validation and id helper"
```

---

## Task 3: Drizzle schema and migrations

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `db/migrate.ts`, `drizzle.config.ts`

- [ ] **Step 1: Implement full schema in `db/schema.ts`** — every table from `solution_builds.md` section 1.4 plus the demo-specific add-ons from section 3 (A1 `compConfidence`, A2 `callOutcomes`, L1 `chatSessions`, C3 `queryLog`):

```ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  submarket: text("submarket"),
  state: text("state"),
  totalSqft: integer("total_sqft"),
  assetType: text("asset_type"),
  yearBuilt: integer("year_built"),
  source: text("source"),
  sourceDocId: text("source_doc_id"),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").references(() => properties.id),
  suite: text("suite"),
  sizeSqft: integer("size_sqft"),
  leaseType: text("lease_type"),
  hasPrivateBathroom: integer("has_private_bathroom", { mode: "boolean" }),
  currentRent: real("current_rent"),
  rentPerSqft: real("rent_per_sqft"),
  leaseStart: integer("lease_start", { mode: "timestamp" }),
  leaseEnd: integer("lease_end", { mode: "timestamp" }),
  tenantName: text("tenant_name"),
});

export const sourceDocuments = sqliteTable("source_documents", {
  id: text("id").primaryKey(),
  type: text("type"),                                 // "om" | "lease" | "psa" | "internal_rent_roll"
  filename: text("filename"),
  pdfPath: text("pdf_path"),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
});

export const compConfidence = sqliteTable("comp_confidence", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id),
  rentConfidence: text("rent_confidence"),            // "high" | "medium" | "low"
  sourceType: text("source_type"),                    // "signed_lease" | "om_rent_roll" | "costar_estimate"
  rawQuote: text("raw_quote"),
  extractedFromPage: integer("extracted_from_page"),
});

export const leases = sqliteTable("leases", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id),
  pdfPath: text("pdf_path"),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
});

export const leaseAbstracts = sqliteTable("lease_abstracts", {
  id: text("id").primaryKey(),
  leaseId: text("lease_id").references(() => leases.id),
  tenantName: text("tenant_name"),
  landlordName: text("landlord_name"),
  propertyAddress: text("property_address"),
  suite: text("suite"),
  leaseStart: integer("lease_start", { mode: "timestamp" }),
  leaseEnd: integer("lease_end", { mode: "timestamp" }),
  baseRentSchedule: text("base_rent_schedule"),       // JSON
  escalations: text("escalations"),                   // JSON
  renewalOptions: text("renewal_options"),            // JSON
  tiAllowance: real("ti_allowance"),
  freeRentMonths: integer("free_rent_months"),
  securityDeposit: real("security_deposit"),
  camTerms: text("cam_terms"),                        // JSON
  useClause: text("use_clause"),
  specialProvisions: text("special_provisions"),     // JSON
  extractionConfidence: text("extraction_confidence"),// JSON per-field
  rawSections: text("raw_sections"),                  // JSON: [{ section, page, text }] for C3 retrieval
  extractedAt: integer("extracted_at", { mode: "timestamp" }),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  source: text("source"),
  businessType: text("business_type"),
  spaceSizeSqft: integer("space_size_sqft"),
  location: text("location"),
  timeline: text("timeline"),
  budgetRange: text("budget_range"),
  callbackPreferred: integer("callback_preferred", { mode: "boolean" }),
  rawTranscript: text("raw_transcript"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").references(() => leads.id),
  startedAt: integer("started_at", { mode: "timestamp" }),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  transcript: text("transcript"),
});

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  propertyName: text("property_name"),
  psaPath: text("psa_path"),
  psaSignedAt: integer("psa_signed_at", { mode: "timestamp" }),
  depositDueAt: integer("deposit_due_at", { mode: "timestamp" }),
  ddEndAt: integer("dd_end_at", { mode: "timestamp" }),
  closingAt: integer("closing_at", { mode: "timestamp" }),
  status: text("status"),
  extractedSummary: text("extracted_summary"),        // JSON dump of PSA extraction
});

export const onboardingTasks = sqliteTable("onboarding_tasks", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").references(() => deals.id),
  taskType: text("task_type"),
  assignee: text("assignee"),
  dueAt: integer("due_at", { mode: "timestamp" }),
  status: text("status"),
  blocker: text("blocker"),
});

export const rfpDrafts = sqliteTable("rfp_drafts", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").references(() => deals.id),
  vendorType: text("vendor_type"),
  subject: text("subject"),
  content: text("content"),
  generatedAt: integer("generated_at", { mode: "timestamp" }),
  sentAt: integer("sent_at", { mode: "timestamp" }),
});

export const callTargets = sqliteTable("call_targets", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").references(() => properties.id),
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  status: text("status"),
  outcome: text("outcome"),
  transcript: text("transcript"),
  hotLeadFlag: integer("hot_lead_flag", { mode: "boolean" }),
  calledAt: integer("called_at", { mode: "timestamp" }),
});

export const callOutcomes = sqliteTable("call_outcomes", {
  id: text("id").primaryKey(),
  targetId: text("target_id").references(() => callTargets.id),
  durationSeconds: integer("duration_seconds"),
  outcome: text("outcome"),
  transcript: text("transcript"),
  hotLeadFlag: integer("hot_lead_flag", { mode: "boolean" }),
  notifiedAt: integer("notified_at", { mode: "timestamp" }),
});

export const queryLog = sqliteTable("query_log", {
  id: text("id").primaryKey(),
  query: text("query"),
  response: text("response"),
  citations: text("citations"),                       // JSON
  responseTimeMs: integer("response_time_ms"),
  timestamp: integer("timestamp", { mode: "timestamp" }),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  kind: text("kind"),                                 // "hot_lead" | "qualified_lead" | "deposit_due" | ...
  title: text("title"),
  body: text("body"),
  link: text("link"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  readAt: integer("read_at", { mode: "timestamp" }),
});
```

- [ ] **Step 2: Implement `db/client.ts`:**

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { env } from "@/lib/env";

const url = env().DATABASE_URL.replace(/^file:/, "");
const sqlite = new Database(url);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
```

- [ ] **Step 3: Implement `drizzle.config.ts`:**

```ts
import type { Config } from "drizzle-kit";
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: "./db/kfp-demo.db" },
} satisfies Config;
```

- [ ] **Step 4: Implement `db/migrate.ts`:**

```ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dbPath = "./db/kfp-demo.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: "./db/migrations" });
console.log("Migrations applied to", dbPath);
sqlite.close();
```

- [ ] **Step 5: Generate first migration.** `pnpm db:generate` then `pnpm db:migrate`. Expected: `db/migrations/0000_*.sql` exists, `db/kfp-demo.db` exists.
- [ ] **Step 6: Add FTS5 virtual table** via a hand-written migration `db/migrations/9999_fts.sql` (run after schema migrations) for C3 retrieval:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS lease_sections_fts USING fts5(
  lease_id, section, page UNINDEXED, text
);
```

Update `db/migrate.ts` to also exec this SQL after `migrate()`.

- [ ] **Step 7: Commit.**

```bash
git add db/ drizzle.config.ts
git commit -m "feat(db): drizzle schema, client, migrations, FTS5 for lease retrieval"
```

---

## Task 4: Shared Anthropic client with logging wrapper

**Files:**
- Create: `lib/anthropic.ts`, `tests/lib/anthropic.test.ts`

- [ ] **Step 1: Write failing test:**

```ts
import { describe, it, expect, vi } from "vitest";
import { pickModel } from "@/lib/anthropic";

describe("pickModel", () => {
  it("returns sonnet by default", () => {
    expect(pickModel("default")).toBe("claude-sonnet-4-6");
  });
  it("returns opus for high-stakes", () => {
    expect(pickModel("high-stakes")).toBe("claude-opus-4-7");
  });
  it("returns haiku for fast classification", () => {
    expect(pickModel("fast")).toBe("claude-haiku-4-5-20251001");
  });
});
```

- [ ] **Step 2: Implement `lib/anthropic.ts`:**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export type Tier = "default" | "high-stakes" | "fast";

export function pickModel(tier: Tier): string {
  switch (tier) {
    case "high-stakes": return "claude-opus-4-7";
    case "fast": return "claude-haiku-4-5-20251001";
    default: return "claude-sonnet-4-6";
  }
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}

export type LLMCallMeta = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estCostUsd: number;
};

// Rough cost table per 1M tokens (input / output) — used for log-only cost estimates.
const COSTS: Record<string, [number, number]> = {
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-4-7": [15, 75],
  "claude-haiku-4-5-20251001": [1, 5],
};

export function estimateCost(model: string, input: number, output: number) {
  const [ic, oc] = COSTS[model] ?? [0, 0];
  return (input / 1_000_000) * ic + (output / 1_000_000) * oc;
}

export function logLLM(meta: LLMCallMeta) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[LLM] model=${meta.model} in=${meta.inputTokens} out=${meta.outputTokens} ${meta.latencyMs}ms ~$${meta.estCostUsd.toFixed(4)}`);
  }
}
```

- [ ] **Step 3: Run tests.** `pnpm test tests/lib/anthropic.test.ts`. Expected: PASS.
- [ ] **Step 4: Commit.**

```bash
git add lib/anthropic.ts tests/lib/anthropic.test.ts
git commit -m "feat(lib): Anthropic client with model tiering and cost logging"
```

---

## Task 5: Shared PDF pipeline (text + vision)

**Files:**
- Create: `lib/pdf.ts`, `tests/lib/pdf.test.ts`, `tests/fixtures/sample.pdf` (committed small fixture)

- [ ] **Step 1: Implement `lib/pdf.ts`** with two extraction paths: native Anthropic PDF doc support (primary) and unpdf text extraction (fallback for token economy):

```ts
import { extractText, getDocumentProxy } from "unpdf";
import fs from "node:fs/promises";
import path from "node:path";
import { anthropic, logLLM, estimateCost, pickModel, type Tier } from "./anthropic";

export type ExtractedPage = { page: number; text: string };

export async function extractPdfText(filePath: string): Promise<ExtractedPage[]> {
  const buf = await fs.readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const out: ExtractedPage[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { text } = await extractText(pdf, { mergePages: false, page: p });
    out.push({ page: p, text: Array.isArray(text) ? text.join("\n") : String(text) });
  }
  return out;
}

export async function extractWithVision<T>(args: {
  filePath: string;
  systemPrompt: string;
  userPrompt: string;
  tier?: Tier;
  parse: (jsonText: string) => T;
}): Promise<{ data: T; meta: { model: string; latencyMs: number } }> {
  const buf = await fs.readFile(args.filePath);
  const base64 = buf.toString("base64");
  const model = pickModel(args.tier ?? "default");
  const started = Date.now();
  const res = await anthropic().messages.create({
    model,
    max_tokens: 8000,
    system: args.systemPrompt,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: args.userPrompt },
      ],
    }],
  });
  const latencyMs = Date.now() - started;
  const text = res.content.filter(c => c.type === "text").map(c => (c as { text: string }).text).join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in LLM response");
  const data = args.parse(jsonMatch[0]);
  logLLM({
    model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    latencyMs,
    estCostUsd: estimateCost(model, res.usage.input_tokens, res.usage.output_tokens),
  });
  return { data, meta: { model, latencyMs } };
}

export async function savePdfToUploads(file: File, subdir: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "uploads", subdir);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
  const full = path.join(dir, filename);
  await fs.writeFile(full, buf);
  return path.relative(process.cwd(), full);
}
```

- [ ] **Step 2: Write a unit test for `extractPdfText`** using a tiny committed fixture PDF (1 page, "Hello world") at `tests/fixtures/sample.pdf`:

```ts
import { describe, it, expect } from "vitest";
import { extractPdfText } from "@/lib/pdf";
import path from "node:path";

describe("extractPdfText", () => {
  it("extracts text from a 1-page PDF", async () => {
    const pages = await extractPdfText(path.resolve("tests/fixtures/sample.pdf"));
    expect(pages).toHaveLength(1);
    expect(pages[0].text.toLowerCase()).toContain("hello");
  });
});
```

(The actual fixture PDF is generated via `pdfkit` in a one-off script and committed. If `pdfkit` is heavy, use a tiny pre-built blank-text PDF; either way commit the file.)

- [ ] **Step 3: Run tests.** Expected: PASS.
- [ ] **Step 4: Commit.**

```bash
git add lib/pdf.ts tests/lib/pdf.test.ts tests/fixtures/sample.pdf
git commit -m "feat(lib): PDF pipeline with unpdf text and Anthropic document vision"
```

---

## Task 6: Confidence scoring helpers and shared types

**Files:**
- Create: `lib/confidence.ts`, `tests/lib/confidence.test.ts`

- [ ] **Step 1: Implement `lib/confidence.ts`:**

```ts
import { z } from "zod";

export const ConfidenceLevel = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const ConfidenceMap = z.record(z.string(), z.object({
  level: ConfidenceLevel,
  reason: z.string().optional(),
}));
export type ConfidenceMap = z.infer<typeof ConfidenceMap>;

export const SOURCE_RANK: Record<string, ConfidenceLevel> = {
  signed_lease: "high",
  om_rent_roll: "medium",
  costar_estimate: "low",
};

export function badgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case "high": return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "medium": return "bg-amber-100 text-amber-900 border-amber-300";
    case "low": return "bg-rose-100 text-rose-900 border-rose-300";
  }
}

export function lowestField(map: ConfidenceMap): ConfidenceLevel {
  const order: ConfidenceLevel[] = ["low", "medium", "high"];
  for (const lvl of order) {
    for (const k of Object.keys(map)) if (map[k].level === lvl) return lvl;
  }
  return "high";
}
```

- [ ] **Step 2: Test:**

```ts
import { describe, it, expect } from "vitest";
import { ConfidenceMap, lowestField, badgeClass } from "@/lib/confidence";

describe("confidence", () => {
  it("lowestField returns low when any field is low", () => {
    const map = ConfidenceMap.parse({ a: { level: "high" }, b: { level: "low" } });
    expect(lowestField(map)).toBe("low");
  });
  it("badgeClass returns a tailwind class string", () => {
    expect(badgeClass("high")).toContain("emerald");
    expect(badgeClass("low")).toContain("rose");
  });
});
```

- [ ] **Step 3: Run tests.** Expected: PASS.
- [ ] **Step 4: Commit.**

```bash
git add lib/confidence.ts tests/lib/confidence.test.ts
git commit -m "feat(lib): confidence map types and badge helpers"
```

---

## Task 7: Notification dispatcher (Slack optional, in-app required)

**Files:**
- Create: `lib/notify.ts`, `app/api/notifications/route.ts`

- [ ] **Step 1: Implement `lib/notify.ts`:**

```ts
import { db, schema } from "@/db/client";
import { id } from "./ids";
import { env } from "./env";

export type NotifyInput = {
  kind: "hot_lead" | "qualified_lead" | "deposit_due" | "rfp_ready" | "extraction_complete";
  title: string;
  body: string;
  link?: string;
};

export async function notify(input: NotifyInput) {
  await db.insert(schema.notifications).values({
    id: id("ntf"),
    kind: input.kind,
    title: input.title,
    body: input.body,
    link: input.link,
    createdAt: new Date(),
  });
  const slack = env().SLACK_WEBHOOK_URL;
  if (slack) {
    await fetch(slack, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `*${input.title}*\n${input.body}${input.link ? `\n${input.link}` : ""}` }),
    }).catch(() => undefined);
  }
}
```

- [ ] **Step 2: Implement `app/api/notifications/route.ts`** — `GET` returns recent notifications, `PUT` marks all as read. Standard `{ data, error }` shape per conventions.

- [ ] **Step 3: Commit.**

```bash
git add lib/notify.ts app/api/notifications/
git commit -m "feat(lib): notification dispatcher with optional Slack relay"
```

---

## Task 8: App shell (sidebar + top bar + providers)

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/providers.tsx`, `components/shell/Sidebar.tsx`, `components/shell/TopBar.tsx`

- [ ] **Step 1: Implement `app/providers.tsx`** wrapping TanStack Query + shadcn `Toaster`.

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Implement `components/shell/Sidebar.tsx`** with seven nav items: Home, A1 Market Intelligence, A2 Voice Agent, A3 Onboarding, L1 Website Chat, L2 Lease Abstraction, C3 Lease Intelligence. Use `lucide-react` icons (Home, BarChart3, PhoneOutgoing, ClipboardCheck, MessageCircle, FileText, Search). Highlight active route via `usePathname`.

- [ ] **Step 3: Implement `components/shell/TopBar.tsx`** with the app name (`NEXT_PUBLIC_APP_NAME`) on the left, a "FlexOps AI × KFP" subtitle in muted text, and a notifications bell on the right that opens a sheet listing recent rows from the `notifications` table.

- [ ] **Step 4: Update `app/layout.tsx`** to render:
- `<html><body class="font-sans">`
- `<Providers>` wrapping `<div class="flex h-screen">`
- `<Sidebar />` on the left (260px), `<main class="flex-1 overflow-y-auto"><TopBar />{children}</main>` on the right.

- [ ] **Step 5: Stub each demo page** (`app/{market-intelligence,voice-agent,onboarding,chat-leasing,lease-abstraction,lease-intelligence}/page.tsx`) with a heading and "Coming up" placeholder so the sidebar links resolve.

- [ ] **Step 6: Run dev server.** `pnpm dev`. Visit `http://localhost:3000`. Expected: sidebar renders, all seven links navigate, no console errors.
- [ ] **Step 7: Commit.**

```bash
git add app/ components/shell/
git commit -m "feat(shell): sidebar nav, top bar with notifications, providers"
```

---

## Task 9: Home page with KFP context and status grid

**Files:**
- Modify: `app/page.tsx`
- Create: `components/shell/StatusGrid.tsx`

- [ ] **Step 1: Implement `components/shell/StatusGrid.tsx`** rendering six demo cards (A1, A2, A3, L1, L2, C3). Each card: ID badge, title, perspective, trigger, status pill ("BUILD NOW" / "BUILD PARTIAL"), one-sentence summary, "Open demo" button linking to its route. Pull the text verbatim from `solution_builds.md` section 3.

- [ ] **Step 2: Implement `app/page.tsx`** as a server component:
- Hero block: "KFP AI Audit Demo Suite" title, 2-3 sentence subtitle citing the engagement context from `CLAUDE.md` (multi-tenant flex industrial, roughly 30 assets).
- "About KFP" panel summarizing the company profile from `CLAUDE.md` "Project Context."
- `<StatusGrid />` below.
- Footer: "Built by FlexOps AI. Demo data is synthetic; no real client data appears in this app."

- [ ] **Step 3: Verify** at `http://localhost:3000/`. Expected: hero + six cards + footer. All six "Open demo" buttons navigate.
- [ ] **Step 4: Commit.**

```bash
git add app/page.tsx components/shell/StatusGrid.tsx
git commit -m "feat(home): KFP context and six-demo status grid"
```

---

## Task 10: Seed scripts for shared mock data

**Files:**
- Create: `db/seed/index.ts`, `db/seed/properties.ts`, `db/seed/units.ts`, `db/seed/deals.ts`, `db/seed/call-targets.ts`, `db/seed/lease-abstracts.ts`, `db/seed/_data.ts`

- [ ] **Step 1: Define `db/seed/_data.ts`** with hand-authored arrays matching the profile parameters in `solution_builds.md` section 1.5:

```ts
export const submarkets = [
  { name: "Parkhurst", state: "TX", rentLow: 12, rentHigh: 15 },
  { name: "Calder", state: "TX", rentLow: 11, rentHigh: 14 },
  { name: "Westbrook", state: "TX", rentLow: 11, rentHigh: 14 },
  { name: "Brightwater", state: "TX", rentLow: 12, rentHigh: 15 },
  { name: "Ashby Beach", state: "TX", rentLow: 11, rentHigh: 13 },
  { name: "Kingsley", state: "TX", rentLow: 9, rentHigh: 12 },
  { name: "Orrington", state: "TX", rentLow: 10, rentHigh: 13 },
  { name: "Altamont", state: "NM", rentLow: 9, rentHigh: 12 },
];

export const tenantTypes = [
  "HVAC contractor", "Plumbing contractor", "Electrical contractor",
  "E-commerce fulfillment", "Light manufacturing", "Distribution",
  "Auto detailing", "Metal fabrication", "Cabinet shop", "Print shop",
];
```

- [ ] **Step 2: Implement `db/seed/properties.ts`** seeding 8 properties (5 Marisol, 3 expansion) with realistic names like "Linwood Commerce Park", addresses, total sqft 30,000-100,000.

- [ ] **Step 3: Implement `db/seed/units.ts`** seeding 10-15 units per property (~96 units total). Sizes biased to 1,500-2,500 sqft. Rent per sqft from the submarket range. 20% with `hasPrivateBathroom: true`. 70% currently leased (random tenant from `tenantTypes`), 30% vacant. Lease start dates spread across the last 4 years, ending 3-5 years out with 3-5% annual escalation baked into rent.

- [ ] **Step 4: Implement `db/seed/deals.ts`** seeding 3 deals at different stages (PSA signed, mid-DD, near-closing) with onboarding tasks and a couple of RFP drafts to populate the blocker view.

- [ ] **Step 5: Implement `db/seed/call-targets.ts`** seeding 25 synthetic Kingsley-market properties with fake owner names and obviously-fake phone numbers (`+15555550100`-style) so live demo can swap in the presenter's number.

- [ ] **Step 6: Implement `db/seed/lease-abstracts.ts`** seeding 6 lease abstracts: 3 form-lease-style (clean, high-confidence), 3 negotiated (TI allowance, free rent, options). Each abstract includes `rawSections` JSON with 4-6 plausible section snippets (Use Clause, Rent Schedule, Operating Expenses, Maintenance, Insurance, Default) used by C3's FTS index.

- [ ] **Step 7: Implement `db/seed/index.ts`** as the orchestrator. Idempotent: deletes-and-reinserts (DEV ONLY) on every run. After insert, populates `lease_sections_fts` from each abstract's `rawSections`.

- [ ] **Step 8: Run seed.** `pnpm db:reset`. Expected: log shows counts (8 properties, ~96 units, 3 deals, 25 call targets, 6 lease abstracts).
- [ ] **Step 9: Commit.**

```bash
git add db/seed/
git commit -m "feat(db): synthetic KFP-profile seed data for all demos"
```

---

## Task 11: Verification gate — foundations work end-to-end

- [ ] **Step 1: Run all tests.** `pnpm test`. Expected: PASS.
- [ ] **Step 2: Run lint.** `pnpm lint`. Expected: clean.
- [ ] **Step 3: Run dev server.** `pnpm dev`. Visit Home and click every sidebar link. Expected: shell renders, no errors.
- [ ] **Step 4: Verify env validation** by temporarily removing `ANTHROPIC_API_KEY` from `.env.local`. Restart dev. Expected: server fails fast with a clear message. Restore the key.

**Gate condition:** all four steps pass before opening Group 2.

---

# Group 2: Independent Demos (L1 + A2)

Parallelizable. No PDF dependency. Both write to the existing shared DB via the established notify/anthropic/confidence helpers.

## Task 12: L1 — Prompts and zod schemas

**Files:**
- Create: `lib/prompts/leasing-chat.ts`, `lib/prompts/extract-lead.ts`, `tests/prompts/leasing-chat.test.ts`

- [ ] **Step 1: `lib/prompts/leasing-chat.ts`** exporting `leasingChatSystemPrompt({ availability })` that injects a compact summary of currently-vacant units (suite, sqft, submarket, rent/sqft) into the system prompt verbatim from `solution_builds.md` section 3.L1 (no em dashes; use commas/periods).

- [ ] **Step 2: `lib/prompts/extract-lead.ts`** exporting `extractLeadPrompt(transcript)` and a zod schema `LeadExtraction`:

```ts
export const LeadExtraction = z.object({
  businessType: z.string().nullable(),
  spaceSizeSqft: z.number().int().positive().nullable(),
  location: z.string().nullable(),
  timeline: z.string().nullable(),
  budgetRange: z.string().nullable(),
  callbackPreferred: z.boolean(),
  summary: z.string(),
});
```

- [ ] **Step 3: Unit test** the prompt builder shape and the schema parsing (rejects negative sqft, accepts nulls).
- [ ] **Step 4: Commit.**

```bash
git add lib/prompts/leasing-chat.ts lib/prompts/extract-lead.ts tests/prompts/leasing-chat.test.ts
git commit -m "feat(l1): chat system prompt and lead extraction schema"
```

---

## Task 13: L1 — Streaming chat API route and completion route

**Files:**
- Create: `app/api/chat/leasing/route.ts`, `app/api/chat/leasing/complete/route.ts`, `app/api/leads/route.ts`

- [ ] **Step 1: `POST /api/chat/leasing`** accepts `{ sessionId, messages: [{role, content}] }`, fetches vacant units from DB, builds system prompt, calls Anthropic with `stream: true`, returns a streaming `Response` of plain text deltas.
- [ ] **Step 2: `POST /api/chat/leasing/complete`** accepts `{ sessionId, transcript }`, runs `extractLeadPrompt`, validates with `LeadExtraction`, inserts a `leads` row + `chatSessions` row, fires `notify({ kind: "qualified_lead", ... })`.
- [ ] **Step 3: `GET /api/leads`** returns leads ordered by `createdAt` desc.
- [ ] **Step 4: Test the complete route's happy path** with a mocked Anthropic call returning canned JSON. Verify a lead row lands in the DB.
- [ ] **Step 5: Commit.**

```bash
git add app/api/chat/ app/api/leads/
git commit -m "feat(l1): streaming chat endpoint, lead extraction, leads list"
```

---

## Task 14: L1 — Mock keystoneflex.example site and embedded chat widget

**Files:**
- Create: `components/l1/KeystoneMockSite.tsx`, `components/l1/ChatWidget.tsx`, `components/l1/LeadInbox.tsx`
- Modify: `app/chat-leasing/page.tsx`

- [ ] **Step 1: `KeystoneMockSite.tsx`** — a styled landing page that visually resembles a flex industrial leasing site: hero ("Find your next flex industrial space"), feature grid (4 cards: Marisol coverage, 1000-5000 sqft units, NNN flex leases, fast move-in), a "Featured properties" strip pulled from seeded properties, and a footer. No real navigation, this is a presenter prop.
- [ ] **Step 2: `ChatWidget.tsx`** — corner-pinned widget (`fixed bottom-6 right-6`), closed by default with a chat bubble icon. On click expands to a chat panel:
  - Maintains messages in local state + session ID via `nanoid`.
  - On user submit, posts to `/api/chat/leasing` with full history, reads streaming response into the latest assistant message.
  - Detects "conversation complete" signal: when the assistant message ends with the marker `[[LEAD_READY]]` (instructed in system prompt), strip the marker and POST to `/api/chat/leasing/complete`.
- [ ] **Step 3: `LeadInbox.tsx`** — table view via `useQuery` against `/api/leads`. Columns: created at, business type, sqft, location, timeline, budget, source. Row click expands a transcript drawer.
- [ ] **Step 4: `app/chat-leasing/page.tsx`** — `Tabs` with two values: "keystoneflex.example (Demo)" rendering `KeystoneMockSite` + `ChatWidget`, and "Leasing Team Inbox" rendering `LeadInbox`.
- [ ] **Step 5: Manual acceptance** per spec section 3.L1 criteria: run the qualifier, confirm all five fields appear in the inbox, confirm streaming is visible token-by-token, confirm no auto-reply (lead is "ready," not "sent").
- [ ] **Step 6: Commit.**

```bash
git add components/l1/ app/chat-leasing/
git commit -m "feat(l1): keystoneflex.example mock site, chat widget, leasing inbox"
```

---

## Task 15: A2 — Prompts, schemas, and outcome classifier

**Files:**
- Create: `lib/prompts/voice-script.ts`, `lib/prompts/classify-call.ts`, `tests/prompts/classify-call.test.ts`

- [ ] **Step 1: `lib/prompts/voice-script.ts`** exports `voiceScriptForTarget({ market, address, ownerName })` returning the script verbatim from `solution_builds.md` section 3.A2 (substituting placeholders, no em dashes).
- [ ] **Step 2: `lib/prompts/classify-call.ts`** exports `classifyCall(transcript)` + zod schema:

```ts
export const CallClassification = z.object({
  outcome: z.enum(["interested", "not_interested", "no_answer", "wrong_number", "call_back_later"]),
  hotLead: z.boolean(),
  priceMentioned: z.string().nullable(),
  notes: z.string(),
});
```

Uses Haiku 4.5 (`tier: "fast"`).

- [ ] **Step 3: Test classifier** with three canned transcripts (interested with price, flat "not interested," beeps-only no answer). Verify enum + hotLead values.
- [ ] **Step 4: Commit.**

```bash
git add lib/prompts/voice-script.ts lib/prompts/classify-call.ts tests/prompts/classify-call.test.ts
git commit -m "feat(a2): voice script builder, outcome classifier with Haiku"
```

---

## Task 16: A2 — Vapi integration (live mode + simulated mode)

**Files:**
- Create: `lib/vapi.ts`, `app/api/voice/start/route.ts`, `app/api/voice/webhook/route.ts`, `app/api/voice/targets/route.ts`

- [ ] **Step 1: `lib/vapi.ts`** — thin wrapper around Vapi REST. Exports `startOutboundCall({ phoneNumberId, customerPhone, systemPrompt, metadata })`. If `VAPI_API_KEY` is missing, throws `VapiNotConfigured`.

- [ ] **Step 2: `POST /api/voice/start`** accepts `{ targetId, presenterPhone }`. Loads target, builds script, calls `startOutboundCall` against `presenterPhone` (so presenter plays the owner). If `VapiNotConfigured`, returns a 200 with `{ data: { simulated: true } }` and the route also runs the classifier against a canned transcript fixture, writing a `callOutcomes` row.

- [ ] **Step 3: `POST /api/voice/webhook`** — Vapi end-of-call webhook. Receives transcript + duration, runs `classifyCall`, writes `callOutcomes`, updates `callTargets.outcome` + `hotLeadFlag`, fires `notify({ kind: "hot_lead" })` if hot.

- [ ] **Step 4: `GET /api/voice/targets`** returns all `callTargets` joined to their latest outcome.

- [ ] **Step 5: Test** the simulated-mode path end to end (no Vapi key in env): hitting `/api/voice/start` writes an outcome and a notification.
- [ ] **Step 6: Commit.**

```bash
git add lib/vapi.ts app/api/voice/
git commit -m "feat(a2): Vapi outbound call wrapper plus simulated-mode fallback"
```

---

## Task 17: A2 — UI (target list, live panel, outcome dashboard)

**Files:**
- Create: `components/a2/TargetList.tsx`, `components/a2/LiveCallPanel.tsx`, `components/a2/OutcomeDashboard.tsx`
- Modify: `app/voice-agent/page.tsx`

- [ ] **Step 1: `TargetList.tsx`** — left column. Displays `callTargets` with owner, phone (masked except for demo), address, status badge. "Start test call" button per row prompts for the presenter's phone via a `Dialog` then POSTs to `/api/voice/start`.
- [ ] **Step 2: `LiveCallPanel.tsx`** — right column. When a call is in flight, polls `/api/voice/targets?id=...` every 2s for transcript updates (Vapi pushes via webhook; polling reads the latest DB state). Renders the transcript as a chat-style stream with the outcome chip appearing after the call ends.
- [ ] **Step 3: `OutcomeDashboard.tsx`** — counts of each outcome bucket + a "Hot Leads" list with timestamps.
- [ ] **Step 4: `app/voice-agent/page.tsx`** — two-column layout with `TargetList`, `LiveCallPanel`, `OutcomeDashboard` below.
- [ ] **Step 5: Manual acceptance** per spec section 3.A2:
  - If Vapi configured: place a real call to presenter's phone, see transcript stream, hot lead notification fires.
  - If not: simulated-mode produces the same UI flow with a canned transcript.
- [ ] **Step 6: Commit.**

```bash
git add components/a2/ app/voice-agent/
git commit -m "feat(a2): target list, live call panel, outcome dashboard"
```

---

# Group 3: PDF-Dependent Demos (L2, A1, A3)

Parallelizable. Each owns its own prompt + zod schema + route + UI. All three depend only on Group 1 (PDF pipeline) being done.

## Task 18: L2 — Lease extraction prompt and schema

**Files:**
- Create: `lib/prompts/extract-lease.ts`, `tests/prompts/extract-lease.test.ts`

- [ ] **Step 1: `lib/prompts/extract-lease.ts`** exports `extractLeasePrompt(meta)` (system + user) and the full zod schema mirroring `solution_builds.md` section 3.L2:

```ts
export const RentStep = z.object({
  from: z.string(),
  to: z.string(),
  monthlyRent: z.number(),
  annualRentPerSqft: z.number(),
});

export const LeaseAbstract = z.object({
  tenantName: z.string(),
  landlordName: z.string(),
  propertyAddress: z.string(),
  suite: z.string(),
  leaseStart: z.string(),
  leaseEnd: z.string(),
  baseRentSchedule: z.array(RentStep),
  escalations: z.object({
    type: z.enum(["fixed_pct", "stepped", "cpi", "none"]),
    details: z.string().nullable(),
  }),
  renewalOptions: z.array(z.object({
    number: z.number().int(),
    termYears: z.number(),
    noticeRequired: z.string().nullable(),
  })),
  tiAllowancePerSqft: z.number().nullable(),
  freeRentMonths: z.number().int().nullable(),
  securityDeposit: z.number().nullable(),
  cam: z.object({
    type: z.enum(["NNN", "MG", "Gross"]),
    recoveryMethod: z.string().nullable(),
    caps: z.string().nullable(),
  }),
  useClause: z.string().nullable(),
  specialProvisions: z.array(z.string()),
  rawSections: z.array(z.object({
    section: z.string(),
    page: z.number().int(),
    text: z.string(),
  })),
  confidence: ConfidenceMap,
});
```

- [ ] **Step 2: Test** that the schema rejects an extraction missing required fields and accepts a full canned example.
- [ ] **Step 3: Commit.**

---

## Task 19: L2 — Extract route, abstract get/put, push-to-Yardi format

**Files:**
- Create: `app/api/lease/extract/route.ts`, `app/api/lease/[id]/abstract/route.ts`

- [ ] **Step 1: `POST /api/lease/extract`** — accepts a multipart upload, saves to `uploads/leases/`, calls `extractWithVision` with `tier: "high-stakes"` (Opus 4.7), validates against `LeaseAbstract`, inserts `leases` + `leaseAbstracts` rows, populates `lease_sections_fts` from `rawSections`. Returns the abstract + confidence.
- [ ] **Step 2: `GET /api/lease/[id]/abstract`** returns the saved row hydrated (JSON-parse the JSON cols).
- [ ] **Step 3: `PUT /api/lease/[id]/abstract`** accepts a partial abstract from the editor, validates and updates.
- [ ] **Step 4: Test** the route with a small fixture lease PDF (one of the seeded fixtures) and a stubbed Anthropic client returning canned JSON. Verify DB write.
- [ ] **Step 5: Commit.**

---

## Task 20: L2 — UI (lease list, PDF viewer, abstract editor, push modal)

**Files:**
- Create: `components/l2/LeaseList.tsx`, `components/shared/PDFViewer.tsx`, `components/l2/AbstractEditor.tsx`, `components/l2/PushToYardiModal.tsx`, `components/shared/PDFUploader.tsx`, `components/shared/ConfidenceBadge.tsx`
- Modify: `app/lease-abstraction/page.tsx`

- [ ] **Step 1: `PDFViewer.tsx`** — embed via `<iframe src="/api/files/[path]" />` route or `<object>`. Page-by-page is satisfied by browser's native viewer for the demo; advanced pagination is YAGNI.
- [ ] **Step 2: `ConfidenceBadge.tsx`** — small pill colored per `badgeClass`.
- [ ] **Step 3: `PDFUploader.tsx`** — shared drag-and-drop upload box. Accepts a `uploadUrl` prop and a `onSuccess` callback.
- [ ] **Step 4: `LeaseList.tsx`** — left pane, shows seeded + uploaded leases.
- [ ] **Step 5: `AbstractEditor.tsx`** — right pane. Renders every key term with `ConfidenceBadge`, low-confidence fields visually flagged (red border, sort to top of a "Needs review" section). Inline-edit on field click, PUTs to the abstract endpoint.
- [ ] **Step 6: `PushToYardiModal.tsx`** — modal showing a flat key-value table (Tenant, Suite, Start, End, Base Rent, Annual Escalation, TI, Free Rent, Security Deposit, CAM type, Special Provisions). "Copy all" button.
- [ ] **Step 7: `app/lease-abstraction/page.tsx`** — three-pane layout: LeaseList | PDFViewer | AbstractEditor, with "Upload Lease" in a top bar and "Push to Yardi" button on the selected abstract.
- [ ] **Step 8: Need a file-serving route.** Create `app/api/files/[...path]/route.ts` that streams files from `uploads/` and `db/seed/*-fixtures/` (and nowhere else, by path-prefix allowlist).
- [ ] **Step 9: Manual acceptance** per spec section 3.L2 criteria.
- [ ] **Step 10: Commit.**

---

## Task 21: A1 — OM extraction prompt + ingest route + search route

**Files:**
- Create: `lib/prompts/extract-om.ts`, `app/api/ingest-om/route.ts`, `app/api/search-comps/route.ts`, `app/api/properties/[id]/units/route.ts`

- [ ] **Step 1: `lib/prompts/extract-om.ts`** — system + user prompt verbatim from `solution_builds.md` section 3.A1 plus zod `OMExtraction` schema (property + units[] + confidenceNotes).
- [ ] **Step 2: `POST /api/ingest-om`** — multipart upload, saves to `uploads/oms/`, calls `extractWithVision` with `tier: "default"`, validates, inserts `properties` (source `"om"`), `units`, `compConfidence` rows. Fires `notify({ kind: "extraction_complete" })`.
- [ ] **Step 3: `POST /api/search-comps`** — accepts `{ submarkets[], minSqft, maxSqft, assetType, leaseType }`. SQL `SELECT` joining `units` + `properties` + `compConfidence`. Returns ranked rows (confidence high → low, then most recent ingest), aggregates (median rent/sqft, count).
- [ ] **Step 4: `GET /api/properties/[id]/units`** returns unit detail for the right-pane.
- [ ] **Step 5: Test** the search route against the seeded dataset: a `submarket=Kingsley, minSqft=1500, maxSqft=2500` filter returns the seeded Kingsley expansion units.
- [ ] **Step 6: Commit.**

---

## Task 22: A1 — UI (filter sidebar, comps table, detail panel)

**Files:**
- Create: `components/a1/FilterSidebar.tsx`, `components/a1/CompsTable.tsx`, `components/a1/CompDetailPanel.tsx`, `components/shared/CitationCard.tsx`
- Modify: `app/market-intelligence/page.tsx`

- [ ] **Step 1: `FilterSidebar.tsx`** — multi-select submarket (checkboxes from seeded list), size slider 500-6000 sqft, asset type select, lease type select. Controlled state via URL search params for shareability.
- [ ] **Step 2: `CompsTable.tsx`** — sortable table: suite, property, submarket, sqft, rent/sqft, lease type, confidence. Click selects a row and updates the right pane.
- [ ] **Step 3: `CompDetailPanel.tsx`** — full unit detail + source citation. If unit's `compConfidence` row has `rawQuote`, render in `<CitationCard>` with filename, page, link to source PDF.
- [ ] **Step 4: `CitationCard.tsx`** — shared component (used here and by C3).
- [ ] **Step 5: `app/market-intelligence/page.tsx`** — three-column layout. "Ingest OM" button in the top bar opens `PDFUploader`.
- [ ] **Step 6: Curate and commit 5 public OM PDFs** to `db/seed/om-fixtures/` (industrial flex OMs from public LoopNet/Crexi listings). Update `db/seed/index.ts` to ingest these on first seed via the same extraction pipeline.
- [ ] **Step 7: Manual acceptance** per spec section 3.A1.
- [ ] **Step 8: Commit.**

---

## Task 23: A3 — PSA extraction + RFP draft prompts

**Files:**
- Create: `lib/prompts/extract-psa.ts`, `lib/prompts/draft-rfp.ts`, `tests/prompts/extract-psa.test.ts`

- [ ] **Step 1: `lib/prompts/extract-psa.ts`** — prompt + zod schema:

```ts
export const PSAExtraction = z.object({
  buyer: z.string(),
  seller: z.string(),
  propertyAddresses: z.array(z.string()),
  purchasePrice: z.number().nullable(),
  earnestMoney: z.object({ amount: z.number().nullable(), dueDate: z.string().nullable() }),
  additionalDeposit: z.object({ amount: z.number().nullable(), dueDate: z.string().nullable() }).nullable(),
  ddPeriodDays: z.number().int().nullable(),
  closingDate: z.string().nullable(),
  governingLaw: z.string().nullable(),
  confidence: ConfidenceMap,
});
```

- [ ] **Step 2: `lib/prompts/draft-rfp.ts`** — vendor-type-aware draft prompt. Returns `{ subject, body }`.
- [ ] **Step 3: Test** that the PSA schema rejects a missing buyer and accepts a full example with `closingDate` as ISO string.
- [ ] **Step 4: Commit.**

---

## Task 24: A3 — Extract, draft, deals, blockers routes

**Files:**
- Create: `app/api/onboarding/extract-psa/route.ts`, `app/api/onboarding/draft-rfp/route.ts`, `app/api/onboarding/deals/route.ts`, `app/api/onboarding/blockers/route.ts`

- [ ] **Step 1: `POST /api/onboarding/extract-psa`** — upload PSA, run `extractWithVision`, validate, insert a new `deals` row + four `onboardingTasks` (deposit, COI receipt, four-RFP placeholders), fire `notify({ kind: "deposit_due" })` if deposit due within 7 days.
- [ ] **Step 2: `POST /api/onboarding/draft-rfp`** — accepts `{ dealId, vendorType }`. Loads deal context, runs draft prompt (Haiku, fast), upserts `rfpDrafts` row.
- [ ] **Step 3: `GET /api/onboarding/deals`** returns deals + their tasks.
- [ ] **Step 4: `GET /api/onboarding/blockers`** — flat list of tasks where `status` in (`overdue`, `pending` past `dueAt`).
- [ ] **Step 5: Test** PSA extract with a tiny canned PSA fixture + stubbed Anthropic response.
- [ ] **Step 6: Commit.**

---

## Task 25: A3 — UI (deal list, timeline, RFP tabs, blocker view)

**Files:**
- Create: `components/a3/DealList.tsx`, `components/a3/DealTimeline.tsx`, `components/a3/RFPDraftTabs.tsx`, `components/a3/BlockerView.tsx`
- Modify: `app/onboarding/page.tsx`

- [ ] **Step 1: `DealList.tsx`** — left column. Three seeded deals + "Upload Signed PSA" button.
- [ ] **Step 2: `DealTimeline.tsx`** — horizontal timeline (PSA signed → deposit due → DD end → closing) with current position marker computed from `today` vs deal dates.
- [ ] **Step 3: `RFPDraftTabs.tsx`** — `Tabs` with four values (PCA, Environmental, Survey, Title). Each tab shows the draft subject + textarea body. "Regenerate" calls the draft endpoint. "Mark as sent" stamps `sentAt`.
- [ ] **Step 4: `BlockerView.tsx`** — top-of-page or right-rail list of items needing attention across all deals.
- [ ] **Step 5: `app/onboarding/page.tsx`** — two-column layout per spec.
- [ ] **Step 6: Commit a public PSA template** to `db/seed/psa-fixtures/`. Reference in `app/onboarding/page.tsx` for the "use sample PSA" shortcut.
- [ ] **Step 7: Manual acceptance** per spec section 3.A3 (lender packet remains omitted).
- [ ] **Step 8: Commit.**

---

# Group 4: Chained Demos (C3)

C3 reuses L2's `leaseAbstracts` rows and the `lease_sections_fts` virtual table seeded in Task 10.

## Task 26: C3 — Lease intelligence prompt and retrieval

**Files:**
- Create: `lib/prompts/lease-intelligence.ts`, `lib/retrieval.ts`, `tests/lib/retrieval.test.ts`

- [ ] **Step 1: `lib/retrieval.ts`** — exports `retrieveLeaseSections(query, k=8)` running an FTS5 `MATCH` over `lease_sections_fts` plus a structured-query side path: if the query mentions "expir," route to a date-range filter over `leaseAbstracts.leaseEnd` instead. Returns `Array<{ leaseId, section, page, text, snippet }>`.
- [ ] **Step 2: `lib/prompts/lease-intelligence.ts`** — system + user prompt verbatim from `solution_builds.md` section 3.C3, with a zod-typed response shape:

```ts
export const LeaseAnswer = z.object({
  answer: z.string(),
  citations: z.array(z.object({
    leaseId: z.string(),
    section: z.string(),
    page: z.number().int(),
    quote: z.string(),
  })),
  table: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }).nullable(),
});
```

- [ ] **Step 3: Test retrieval** against the seeded `lease_sections_fts`: query "HVAC" returns the seeded maintenance section.
- [ ] **Step 4: Commit.**

---

## Task 27: C3 — Intelligence route and citation expansion

**Files:**
- Create: `app/api/lease/intelligence/route.ts`, `app/api/lease/[id]/section/[section]/route.ts`

- [ ] **Step 1: `POST /api/lease/intelligence`** — accepts `{ query }`. Runs `retrieveLeaseSections`, builds prompt with retrieved context, calls Sonnet, validates with `LeaseAnswer`, logs to `queryLog` with `responseTimeMs`. Returns `{ data: { answer, citations, table, latencyMs } }`.
- [ ] **Step 2: `GET /api/lease/[id]/section/[section]`** — returns the full section text (from `rawSections` on the abstract row).
- [ ] **Step 3: Test** the route with a stubbed Anthropic call to verify schema validation + logging.
- [ ] **Step 4: Commit.**

---

## Task 28: C3 — UI (chat interface, suggested queries, citation panel)

**Files:**
- Create: `components/c3/ChatInterface.tsx`, `components/c3/SuggestedQueries.tsx`
- Modify: `app/lease-intelligence/page.tsx`

- [ ] **Step 1: `SuggestedQueries.tsx`** — four chips per spec section 3.C3 ("HVAC responsibility for [tenant]", "Leases expiring next quarter", "Compare net effective rents", "Renewal options summary"). `[tenant]` is templated from the first tenant in seeded leases.
- [ ] **Step 2: `ChatInterface.tsx`** — chat input + message history. On submit, POST to `/api/lease/intelligence`, render the answer with inline citation chips. Clicking a citation chip opens the right-pane source view fetching `/api/lease/[id]/section/[section]`.
- [ ] **Step 3: Render `table` output** when present (markdown-style table in the chat reply).
- [ ] **Step 4: `app/lease-intelligence/page.tsx`** — two-pane layout (chat | citation source).
- [ ] **Step 5: Manual acceptance** per spec section 3.C3 (each of the four canned queries returns correct answer + citation, response under 5 seconds).
- [ ] **Step 6: Commit.**

---

# Final Verification

## Task 29: Acceptance walkthrough against the runbook

- [ ] **Step 1: Reset DB.** `pnpm db:reset`.
- [ ] **Step 2: Dev server.** `pnpm dev`.
- [ ] **Step 3: Walk the runbook** from `solution_builds.md` section 4 top to bottom: Home → A1 → A2 → A3 → L1 → L2 → C3. For each demo check off every acceptance criterion from spec section 3.
- [ ] **Step 4: No em dashes.** Run `grep -rn '—' app components lib db tests` (excluding the docs). Expected: zero hits.
- [ ] **Step 5: Lint + tests.** `pnpm lint && pnpm test && pnpm build`. Expected: all green.
- [ ] **Step 6: Capture a runbook recording** (optional, presenter aid).
- [ ] **Step 7: Commit any final fixes.**

```bash
git add -A
git commit -m "chore: acceptance walkthrough complete; all six demos green"
```

---

## Self-Review Checklist (the planner has already run this)

**Spec coverage.** Every requirement in `solution_builds.md` section 3 (UI components, data model, backend APIs, LLM integration, mock data, demo flow, acceptance criteria) maps to a Group-2/3/4 task. Section 1 (architecture, tech stack, repo structure, DB schema, mock strategy) maps to Group 1 tasks 1-10. Section 4 (runbook) maps to Task 29. Section 5 (conventions) is enforced inline (strict TS, zod, `{data,error}` response shape, prompt module structure, confidence surfaced, no em dashes via grep gate, streaming for chat, error boundaries via per-route segments).

**Placeholders.** None. Every prompt, schema, and key file shown in full or referenced to the spec section that supplies its exact content.

**Type consistency.** `LeaseAbstract` (zod) and `leaseAbstracts` (drizzle column names) align: tenant/landlord/property/suite/start/end/baseRentSchedule/escalations/renewalOptions/tiAllowance(PerSqft)/freeRentMonths/securityDeposit/cam/useClause/specialProvisions/extractionConfidence/rawSections. The `tier` argument from `lib/anthropic.ts` is consistently `"default" | "high-stakes" | "fast"`. The notification kinds are stable across `lib/notify.ts` consumers.

**Out-of-scope confirmations** (per `CLAUDE.md`): no Victor automation, no Excel rebuild, no development pipeline, no Commercial Cafe, no Yardi internals, no real client data in repo. Lender packet in A3 explicitly omitted (Task 25).
