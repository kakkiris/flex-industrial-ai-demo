# System Overview

A single Next.js application with a sidebar shell that hosts five demo routes plus a home page. One repo, one deploy, one URL for the validation session. All demos share a single SQLite database, a single Anthropic SDK client, and a common UI shell.

## Layered view

```mermaid
graph TB
    subgraph "Browser UI"
        SHELL["App Shell<br>Sidebar + TopBar + Notifications"]
        HOME["Home<br>KFP context + demo status grid"]
        A1["A1: Market Intelligence Dashboard"]
        A3["A3: Onboarding Orchestration"]
        L1["L1: Website Chat Agent"]
        L2["L2: Lease Abstraction"]
        C3["C3: Lease Document Intelligence"]
    end

    subgraph "Next.js API routes (app/api)"
        API_PROP["/api/properties<br>/api/search-comps"]
        API_OM["/api/ingest-om"]
        API_ONB["/api/onboarding/*<br>(extract-psa, blockers, draft-rfp)"]
        API_CHAT["/api/chat/leasing/*<br>/api/leads"]
        API_LEASE["/api/lease/* (extract, abstract, section)"]
        API_INTEL["/api/lease/intelligence"]
        API_NOTIF["/api/notifications"]
        API_FILES["/api/files/[...path]"]
    end

    subgraph "Shared infra (lib/, db/)"
        ANTH["anthropic.ts<br>tiered model picker"]
        PDF["pdf.ts<br>text + vision extraction"]
        RETR["retrieval.ts<br>FTS5 lease section search"]
        CONF["confidence.ts<br>per-field confidence badges"]
        NOTIFY["notify.ts<br>in-app + optional Slack"]
        PROMPTS["lib/prompts/<br>zod-validated string templates"]
        DB[("SQLite<br>13 tables + lease_sections_fts")]
    end

    SHELL --> HOME & A1 & A3 & L1 & L2 & C3
    A1 --> API_PROP & API_OM
    A3 --> API_ONB
    L1 --> API_CHAT
    L2 --> API_LEASE
    C3 --> API_INTEL
    SHELL --> API_NOTIF
    A1 & A3 & L1 & L2 & C3 --> API_FILES

    API_PROP & API_OM & API_ONB & API_CHAT & API_LEASE & API_INTEL & API_NOTIF --> ANTH
    API_OM & API_ONB & API_LEASE --> PDF
    API_INTEL --> RETR
    API_OM & API_LEASE --> CONF
    API_CHAT & API_LEASE & API_ONB --> NOTIFY
    API_PROP & API_ONB & API_CHAT & API_LEASE & API_INTEL --> DB
    ANTH & PDF & RETR --> PROMPTS
```

## How the five demos relate

| Demo | Perspective | Trigger | Depends on |
| --- | --- | --- | --- |
| A1 Market Intelligence | Portfolio mgmt → acquiring | Submarket evaluation | Properties + units + OM ingestion |
| A3 Onboarding Orchestration | Acquiring | PSA signed | Deals + onboarding tasks + RFP drafts |
| L1 Website Chat | Leasing out | Prospect visits site | Leads + chat sessions; populates Tenant Category for A1 |
| L2 Lease Abstraction | Leasing out | Lease signed | Lease abstracts; feeds C3 retrieval (`rawSections` → FTS5) |
| C3 Lease Intelligence | Leasing out (internal) | NL question over lease library | L2 abstracts; FTS5 virtual table |

A2 Voice Agent was removed from the active build on 2026-05-26; its reference script was kept internally.

## Shared infrastructure layers

- **UI shell** (`components/shell/`): sidebar nav, top bar, notifications bell, status grid on Home.
- **Shared components** (`components/shared/`): PDF uploader, viewer, confidence badge, citation card, streaming response wrapper.
- **API layer** (`app/api/`): Next.js route handlers, grouped per demo plus shared `/api/files/[...path]` for serving anything inside `uploads/`, `db/seed/*-fixtures/`, or `docs/`.
- **LLM layer** (`lib/anthropic.ts`, `lib/prompts/`): tiered model picker (Sonnet 4.6 default, Opus 4.7 high-stakes, Haiku 4.5 fast); all prompts live in `lib/prompts/` as string templates with zod-validated output schemas.
- **PDF extraction** (`lib/pdf.ts`): dual-path extraction (text via `unpdf`, vision via Anthropic native PDF document support) with auto-routing on page-1 char count. See `docs/architecture/pdf-pipeline.md`.
- **Retrieval** (`lib/retrieval.ts`): FTS5 over `lease_sections_fts` virtual table for C3.
- **Confidence scoring** (`lib/confidence.ts`): per-field confidence maps stored as JSON in `lease_abstracts.extraction_confidence` and rendered as badges in L2/A1.
- **Data layer** (`db/`): Drizzle ORM over `better-sqlite3`; 13 tables plus an FTS5 virtual table; see `docs/architecture/data-model.md`.
- **External destinations**: in-app notifications by default; Slack webhook activates when `SLACK_WEBHOOK_URL` is set. Yardi is read-only (paste-ready output only, no integration). Voice platform deferred with A2.
