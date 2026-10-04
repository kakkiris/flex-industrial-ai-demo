# File Layout: Deep Reference

**Purpose.** Layout rules for the KFP demo working folder, as used during the engagement. Tells you where to find what, when to add a new file, and when NOT to. The root `README.md` is the short orientation pointer.

> **Public-version note.** During the engagement the repo sat inside a private client-materials folder holding interview recordings, questionnaires, and client-delivered documents. None of that material is in this public repository; the seeded data under `db/seed/extracted/` has been fictionalized. The rules below are kept because they show how source material was handled.

Read this before adding any file to the demo folder. Apply the de-duplication decision tree below first.

---

## 1. Project Structure

```
<client-materials>/                        ← Private, never committed. Client-delivered source materials.
├── (interview recordings, questionnaires, lease PDFs, OM PDFs, rent roll workbooks, Yardi exports)
└── <repo>/                                ← Demo working folder. You operate inside this.
    ├── CLAUDE.md                                ← project context (read first)
    ├── README.md                                ← short orientation
    ├── solution_builds.md                       ← per-demo build specs
    ├── /app/                                    ← Next.js routes (each active demo has a process.md)
    ├── /lib/, /components/, /db/, /scripts/     ← code
    ├── /docs/
    │   ├── /reference/                          ← reference material (this file, citation legend, runbooks)
    │   ├── /architecture/                       ← technical decisions
    │   ├── /process/                            ← cross-demo current-vs-demo mapping
    │   └── /superpowers/                        ← design specs and implementation plans
    ├── /tests/, /hooks/, /public/
    └── /uploads/                                ← runtime PDF uploads, gitignored
```

The client-materials folder (one level above the repo) holds the **source materials**: discovery interviews, pre-discovery questionnaires, lease PDFs, OM PDFs, the rent roll structure workbook, the kick-off meeting, cold call notes, and any other artifacts.

**You operate inside the repo. You reference client materials via relative paths. You do not duplicate them.**

---

## 2. De-Duplication Decision Tree (REQUIRED)

Before adding any file to the demo folder, run this check.

### Step 1: Check the client-materials folder for an existing copy

Typical contents:

- Discovery interview notes (platform lead, portfolio manager) and the kick-off meeting
- Cold call notes
- Form lease PDF and a scanned legacy lease PDF
- Three broker OM PDFs
- The 54-column rent roll data-structure workbook
- The client's pre-audit list of AI initiatives
- A5 / A1 source materials (delivered 2026-05-30): six Yardi commercial ETL exports (CommLeases, CommUnitXrefs, CommUnits, CommSQFTs, CommChargeSchedules, CommContacts) for a reference property; an acquisition deal set (PSA, closing statement, OM, LOI, underwriting workbook); and a populated rent roll plus rent roll template

### Step 2: Apply the decision tree

For every file you might add:

1. **Does the same file exist in the client-materials folder (by filename or content)?**
   - **Yes:** Do NOT copy it into the repo. Reference it via relative path, or extract it once to JSON (see below).
   - **No:** Continue to step 2.
2. **Is it a build artifact (CLAUDE.md, solution_builds.md, specs, generated code, demo data seeds)?**
   - **Yes:** It belongs in the repo per the layout above. Add it.
   - **No:** Continue to step 3.
3. **Is it a derived view of a client file (e.g., a markdown version of a Word doc)?**
   - **Yes:** Keep it outside the repo, or add it to `docs/reference/` with a header stating which source it derives from. Do not modify the original.
   - **No:** Ask before adding.

### Step 3: When in doubt

List the contents of the client-materials folder first, then decide. Better to spend a tool call confirming than to create a duplicate that drifts from the source.

---

## 3. Demo Fixtures: Reference, Don't Copy

Lease PDFs, OM PDFs, and the rent roll workbook are fixtures for L2, A1, and C3. **Do not commit them into `db/seed/lease-fixtures/`, `db/seed/om-fixtures/`, etc.** (those directories are gitignored). The committed baseline is pre-extracted JSON in `db/seed/extracted/`, produced once by `scripts/pre-extract.ts`, so the seed is LLM-free and the deployed app has the same baseline as local without shipping any source document.

A5 (Acquisition Lease Bulk-Load) and A1's rent recalibration draw on a further set of source materials. They are **format references and ground truth, not live ingest sources**: A5 runs on a committed dataset modeled on them, not a live `.xls` parse, so the demo is flagged "needs Yardi access".

| Source material | Feeds | Role |
| --- | --- | --- |
| Six Yardi commercial ETL exports for a reference property | A5 | A5 emits this exact six-table shape. Format reference; the live `.xls` ingest needs Yardi access. |
| Acquisition deal set (PSA, closing statement, OM, LOI, UW workbook) | A5, A1 | The Foundry worked example. The PSA tenant schedule supplied the roster shape and deposit levels (fictionalized in this public version); the rest is modeled because the rent roll itself was only an attachment reference. The UW workbook informed A1's underwriting methodology. |
| Populated rent roll + rent roll template | A1 | Harbor Park One (Westbrook, Office Y + Bathroom Y, Modified Gross, built-out) anchors the recalibrated $27-30/sqft built-out MG band; 54-col rent roll structure. |

The pre-seed step (`pnpm tsx scripts/verify-fixtures.ts`, wired into `pnpm db:seed`) checks for local fixtures and only warns when they are absent, so a clone of this repo seeds cleanly from the committed JSON.

---

## 4. Source Citations in process.md Files

Each demo route folder contains a `process.md` describing the current vs demo workflow with source citations (`[Discovery-Jordan HH:MM:SS]`, `[Kick-off HH:MM:SS]`, `[Validation 2026-06-04]`, and so on). The legend of tags is at `docs/reference/citation-sources.md`. The sources themselves are confidential and not included here.

---

## 5. Document Authority Hierarchy

If sources conflict:

- **Master discovery synthesis** (kept outside the repo) is canonical for findings, priorities, and solution descriptions. Per-interviewee working passes go deeper on specific workflows; use them as supplements, not contradictions. An adjustments doc holds proposed changes not yet merged into the master; apply these as the working state for the build.
- **solution_builds.md** is canonical for build decisions (tech stack, schemas, demo specs). When the synthesis and solution_builds disagree on a build-level decision, solution_builds wins.
- **CLAUDE.md** is canonical for project conventions (naming, em-dash rule, perspective-and-trigger framing).

**If you see a real contradiction between sources, do not silently pick one.** Surface the conflict.

---

## 6. Reading Order on Session Start

1. `CLAUDE.md`, high-level project context
2. `README.md`, quick orientation and reading map
3. `solution_builds.md`, the build spec for what you are working on
4. Any pending update prompt at root (apply before doing anything else)
5. Relevant `process.md` for the demo you're touching
6. Synthesis material only if the request touches solution rationale that the build spec doesn't already cover

Read interview sources on demand when populating `process.md` content or verifying a specific claim, not on every session.

---

## 7. New Files You May Generate

- Next.js app code under `/app/`, `/lib/`, `/components/`, `/db/`
- Per-demo process documentation: `/app/[demo-route]/process.md` for each active demo: `app/market-intelligence/process.md` (A1), `app/acquisition-bulk-load/process.md` (A5), `app/chat-leasing/process.md` (L1), `app/lease-abstraction/process.md` (L2), and `app/lease-intelligence/process.md` (C3).
- Updated specs: edits to `solution_builds.md` and `CLAUDE.md` as the build evolves
- Test fixtures or scripts under `/db/seed/` or `/scripts/`
- New architecture or reference docs under `/docs/architecture/` or `/docs/reference/`

When you generate documentation that synthesizes client material, add a header listing the sources it cites (by citation tag), so the citation chain stays auditable.

---

## 8. What Happens to Update Prompts After They Run

When you apply an update prompt dropped at the repo root:

1. Move it out of the root into an archive folder, named with the date applied.
2. Prepend a comment header stating which corrections were applied and which were skipped (with reasons).
3. Confirm that the prompt has been applied and archived.

This keeps the repo root clean for future update prompts.
