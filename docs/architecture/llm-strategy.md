# LLM Strategy

A single Anthropic SDK client, one model picker, three named tiers. All prompts live in `lib/prompts/` as exported string-template functions paired with zod schemas. The picker, cost estimator, and structured logger live in `lib/anthropic.ts`.

## Model tiering

Three named tiers selected via `pickModel(tier: "default" | "high-stakes" | "fast")`:

| Tier | Model ID | When to use |
| --- | --- | --- |
| `default` | `claude-sonnet-4-6` | Standard demos: L1 chat, L1 lead extraction, A1 OM extraction, A3 PSA extraction, A3 RFP drafting, C3 intelligence answers. Strong reasoning + structured output, predictable latency, fair cost. |
| `high-stakes` | `claude-opus-4-7` | L2 lease abstraction (both text and vision paths). Leases have legal weight; misreading a rent schedule or escalation clause is costly downstream. Opus also handles the vision path for the scanned legacy lease most reliably. |
| `fast` | `claude-haiku-4-5-20251001` | Reserved for high-volume, low-complexity classification (none in the active build yet). Wired up so future surfaces, e.g., a quick "is this question retrieval-shaped or freeform?" router, can opt in without touching the picker. |

Tier choice happens at the call site by passing `tier` into `extractWithText`, `extractWithVision`, or directly to `anthropic().messages.create({ model: pickModel(...) })`. The model name flows into structured logs and per-request cost estimates so runaway calls are visible during the build.

## Cost and latency

`lib/anthropic.ts` carries an approximate published-price table per million tokens and computes a per-call estimate that lands in dev-mode console logs alongside latency. The numbers are advisory, not billing-grade, they exist to flag the kind of pricing drift that happens when an extraction loops or a prompt blows up its output size.

## Structured output pattern

Every LLM call that produces structured data follows the same pattern:

1. A zod schema in `lib/prompts/[name].ts` defines the response shape.
2. The prompt template instructs the model to return one JSON object only.
3. The model's text reply is scanned for the first balanced JSON object (`firstBalancedJsonObject` in `lib/pdf.ts`).
4. `zod.parse` runs and throws on shape mismatch.

This survives the model occasionally wrapping its response in commentary or ```json fences``` without prompt engineering hacks.

## Confidence scoring

For extractions that downstream users can act on (rent comps, lease abstracts), the schema includes per-field confidence labels (`high` / `medium` / `low`). The model is instructed to ground confidence in source quality:

- `high`, the value is verbatim in the source document
- `medium`, the value is inferred from context with reasonable certainty
- `low`, partial information or ambiguous

`extraction_confidence` is persisted as JSON next to the abstract; `lib/confidence.ts` renders badges and groups "Needs review" items in the L2 reviewer. A1 lifts the same labels into source-quality tiers for rent comps: `high` = signed lease, `medium` = OM rent roll, `low` = CoStar estimate.

## Citation requirements

C3 answers must cite the lease section they were grounded in (section name + page + lease ID). The C3 prompt enforces this and the UI renders citation chips that load the source section in a side pane. If retrieval returns no usable sections, the answer must say so rather than hallucinate.

## Vision fallback

PDF extraction routes to vision when the text path is unviable. See `docs/architecture/pdf-pipeline.md` for the routing logic. Vision calls always run on the `high-stakes` tier (Opus 4.7) because the legacy lease, the canonical vision-path sample, is the demo's hardest extraction problem.

## Prompt location convention

All prompts live in `lib/prompts/`, one file per extraction or chat surface. No prompts inlined in route handlers. This makes it easy to:

- Diff prompt edits cleanly
- Test prompts in isolation (`tests/prompts/`)
- Swap models without touching call sites
- Audit what the LLM is being asked to do without spelunking the API layer

Current prompt files:

- `leasing-chat.ts`, L1 streaming chat with the prospect
- `extract-lead.ts`, L1 lead extraction from a completed transcript
- `extract-om.ts`, A1 OM ingestion
- `extract-psa.ts`, A3 PSA extraction
- `draft-rfp.ts`, A3 RFP drafting
- `extract-lease.ts`, L2 lease abstraction (used by both text and vision paths)
- `lease-intelligence.ts`, C3 answer generation with citations
