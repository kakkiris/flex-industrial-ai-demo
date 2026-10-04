# PDF Pipeline

Demo PDFs ship in two flavors that need fundamentally different extraction strategies. The pipeline auto-routes each upload and persists the chosen path so reviewers can see what ran.

## Why dual-path

The seeded L2 lease samples expose the spread:

- **The KFP form lease sample**: text-native, executed via DocuSign. `unpdf` returns clean text per page. Standard text extraction works perfectly.
- **The legacy lease sample**: a lease inherited from a prior acquisition. Every page is a full-page CCITT gray image at 400 DPI. `unpdf` returns 16 total characters across 16 pages. Text-only extraction would return an empty abstract.

A production lease library contains both kinds. The pipeline has to handle both without a human pre-classifying.

## Routing

`routeExtraction(filePath, threshold = 200)` in `lib/pdf.ts`:

1. Read page 1 text via `unpdf` (`extractText(pdf, { mergePages: false })`).
2. Measure trimmed length of page-1 text.
3. If `length >= threshold`, route to `"text"`. Otherwise route to `"vision"`.
4. If `unpdf` throws (corrupt or weird-encoded PDF), fall back to `"vision"`, Anthropic's native PDF document support handles a wider mix than `unpdf`.

The 200-character threshold was chosen empirically. The KFP form lease's page 1 trivially clears it; the legacy scanned lease's page 1 returns near zero.

## Text path (`extractWithText`)

1. Pull every page with `unpdf`.
2. Join pages with `[page N]` separators into one string.
3. Send as a regular user message to Claude with the caller's system prompt and the joined text interpolated into the user prompt template.
4. Pull the first balanced JSON object out of the response (`firstBalancedJsonObject`).
5. Run the caller's `parse` (typically `zod.parse`) and return `{ data, meta: { model, latencyMs, extractionPath: "text" } }`.

Used for: the KFP form lease in L2, OM text-native pages in A1, PSA extraction in A3.

## Vision path (`extractWithVision`)

1. Read the PDF as bytes, base64-encode.
2. Send to Claude as a document content block (`{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }`) followed by the user prompt text.
3. Same JSON extraction + parse + return as the text path, with `extractionPath: "vision"` in the meta.

Anthropic's native PDF document support handles rasterized pages directly; we do not rasterize ourselves or invoke a separate OCR step. Vision calls run on the `high-stakes` tier (Opus 4.7) because the inputs are the hardest cases the demo encounters.

## Confidence scoring

Both paths return the same structured shape including per-field confidence labels (`high` / `medium` / `low`). The L2 abstract row carries the labels in `extraction_confidence` JSON and the UI renders badges plus a "Needs review" grouping for `low` items. See `docs/architecture/llm-strategy.md` for the confidence rubric.

## Path persistence

The chosen path is stored in `lease_abstracts.extraction_path` so reviewers can see which strategy ran on each row. The L2 UI surfaces the path next to the abstract metadata; the API echoes it back through `meta.extractionPath`.

## How L2 demonstrates both paths

The presenter runbook walks through one seeded abstract from each path so reviewers see the auto-routing in action without having to upload anything live. An "Upload your own lease" affordance is available for ad-hoc demos.

## Failure modes

- **Corrupt/weird PDF that `unpdf` cannot open**, caught in `routeExtraction`, falls through to vision.
- **Vision call rate-limited**, surfaces as a 500 to the route, which the L2 UI shows in a toast. Stagger heavy extractions during the demo (Anthropic burst limits trip if L2 + A1 + A3 + C3 fire in the same minute).
- **Model returns no balanced JSON**, `firstBalancedJsonObject` returns null, the extract function throws `"No JSON object found in LLM response (text path)"` or `"... (vision path)"`, the path label in the error message helps with debugging.
- **`zod.parse` fails**, surfaces the field that failed validation, which usually points at a prompt drift (model returned a slightly different shape than the schema expects). Fix the prompt, not the schema, since the schema is what downstream consumers contract against.

## What this pipeline does NOT do

- Does not retain extracted text in the DB; persists only the structured abstract plus a confidence map.
- Does not OCR client-side or with a separate OCR library, Anthropic vision handles it.
- Does not chunk or stream multi-page PDFs through multiple Claude calls; the whole document goes in one request (works for the demo's page counts, would need rethinking for 100+ page leases).
