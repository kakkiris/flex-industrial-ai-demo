# FlexOps AI: AI Workflow Demos for a Flex Industrial Operator

A product case study: five working AI prototypes built for a commercial real estate operator, taken from discovery interviews through problem framing, prioritization, specs, and a deployable Next.js build. The work was done with Claude (Claude Code for the build, Claude models inside the product).

> **Anonymized.** The client, people, places, properties, tenants, brokers, and deal figures in this repo are fictional or perturbed. The "Marisol" region and every town and county in it are invented. "Keystone Flex Partners" (KFP) is a stand-in for the real client. Source documents (offering memoranda, leases, rent rolls, interview transcripts) are not included; the seed data is pre-extracted, fictionalized JSON.

## The problem

KFP owns and operates a few dozen multi-tenant flex warehouse properties (1,000–5,000 sq ft units leased to contractors, e-commerce, and light-manufacturing tenants). The portfolio grew on top of Excel, email, and a property-management system of record (Yardi). Discovery surfaced the same pattern across teams: high-value documents (broker OMs, leases, closing rent rolls) arrive as PDFs and are re-keyed by hand, and the knowledge inside them is hard to query later.

## What was built

| ID | Demo | User problem it targets |
| --- | --- | --- |
| A1 | **Market Intelligence Dashboard** | Acquisitions re-read broker OMs to find rent comps. OMs are ingested once, units become searchable comps with confidence scores and page-level citations, feeding a quick underwriting view. |
| C3 | **Lease Document Intelligence** | "What does lease X say about Y?" today means opening PDFs. Natural-language Q&A over the lease library with cited answers. |
| L2 | **Lease Abstraction** | Each signed lease is abstracted by hand into Yardi. Upload a lease, get an editable, confidence-flagged abstract, then push it to the system of record. Handles both text PDFs and scanned leases (vision path). |
| A5 | **Acquisition Lease Bulk-Load** | After a closing, every in-place lease is keyed in one at a time. The closing rent roll fans out into the six linked Yardi commercial ETL tables in one load. |
| L1 | **Website Lead Qualification** | Inbound leasing inquiries are unqualified and slow to triage. A structured intake form (default) or conversational chat qualifies the lead and matches available units. |

Each demo has a **current vs. proposed** toggle, so a stakeholder can compare today's manual workflow with the AI-assisted one on the same screen.

## Product process (where to look)

- **Problem → solution framing, per demo:** `app/<demo>/process.md` (current process, pain points, proposed process, what changes for whom)
- **Cross-demo summary:** [`docs/process/current-vs-demo-mapping.md`](docs/process/current-vs-demo-mapping.md)
- **Build specs and acceptance criteria:** [`solution_builds.md`](solution_builds.md)
- **Design specs and implementation plans:** [`docs/superpowers/`](docs/superpowers/) (includes a post-validation update: what changed after the client walkthrough, and why one demo was cut)
- **Architecture and LLM strategy:** [`docs/architecture/`](docs/architecture/)
- **Presenter runbook and usability-testing guide:** [`docs/reference/`](docs/reference/)

Some decisions worth noting:
- **Scope cuts from client feedback.** A property-onboarding checklist demo was dropped after the validation walkthrough: the deal process is human-owned and unpredictable, so a checklist is an aid, not the driver. A voice cold-calling agent was removed earlier at the client's request. Both decisions are recorded in the specs.
- **Trust is built in.** Every extracted field carries a confidence level and a source citation (page and quote), so reviewers verify instead of re-keying.
- **LLM-free seeding.** Document extraction runs once offline (`scripts/pre-extract.ts`), and the demo seeds from committed JSON, so it is reproducible and costs nothing to run.

## Tech

Next.js (App Router) · TypeScript · Drizzle ORM + SQLite · Anthropic Claude API (text + vision extraction, cited Q&A) · Tailwind + shadcn/ui · Vitest

## Run it locally

```bash
pnpm install
cp .env.local.example .env.local   # add ANTHROPIC_API_KEY for the live AI features
pnpm db:migrate
pnpm db:seed
pnpm dev                           # http://localhost:3000
```

`pnpm test` runs the Vitest suite. Browsing the seeded demos works without an API key. Live extraction, chat, and Q&A need one. The original source PDFs are not shipped, so "view source page" links in citations won't open a document.
