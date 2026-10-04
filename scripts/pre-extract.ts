// Pre-extracts the sample OMs and lease PDFs ONCE.
// Output JSON is committed at db/seed/extracted/ so `pnpm db:seed` runs LLM-free.
// Re-run only when the source PDFs change.
//
// Usage:  pnpm tsx scripts/pre-extract.ts            (extracts all five)
//         pnpm tsx scripts/pre-extract.ts --leases   (skip OMs)
//         pnpm tsx scripts/pre-extract.ts --oms      (skip leases)
//         pnpm tsx scripts/pre-extract.ts --only=crestview  (single target)

import fs from "node:fs/promises";
import path from "node:path";
import { routeExtraction, extractWithText, extractWithVision } from "@/lib/pdf";
import { OMExtraction, extractOmPrompt } from "@/lib/prompts/extract-om";
import {
  LeaseAbstract,
  extractLeasePrompt,
} from "@/lib/prompts/extract-lease";

const PARENT_DIR = path.resolve(process.cwd(), "..");
const EXTRACTED_DIR = path.resolve(process.cwd(), "db/seed/extracted");

type Target = {
  key: string;
  filename: string;          // file under the parent fixtures folder
  kind: "om" | "lease";
  knownAddress?: string;
};

const TARGETS: Target[] = [
  { key: "crestview", filename: "Crestview OM.pdf", kind: "om" },
  { key: "uptown", filename: "Uptown Realty Advisors OM.pdf", kind: "om" },
  { key: "meridian", filename: "Meridian OM.pdf", kind: "om" },
  { key: "keystone-lease", filename: "Keystone Lease Sample.pdf", kind: "lease" },
  { key: "legacy-lease", filename: "Legacy Lease Sample.pdf", kind: "lease" },
];

function parseArgs(): { kinds: Set<"om" | "lease">; only: string | null } {
  const args = process.argv.slice(2);
  let kinds: Set<"om" | "lease"> = new Set(["om", "lease"]);
  let only: string | null = null;
  for (const a of args) {
    if (a === "--leases") kinds = new Set(["lease"]);
    else if (a === "--oms") kinds = new Set(["om"]);
    else if (a.startsWith("--only=")) only = a.slice("--only=".length);
  }
  return { kinds, only };
}

// OMs in the KFP sample set carry long rent rolls (sometimes 20+ units) plus
// per-unit rawQuote + confidence entries; the JSON balloons easily past 8000
// tokens which gets the response truncated mid-string and breaks our balanced-
// brace parser. Push the ceiling high enough for the worst case.
const OM_MAX_TOKENS = 16000;
const LEASE_MAX_TOKENS = 16000;

async function extractOm(t: Target): Promise<unknown> {
  const filePath = path.join(PARENT_DIR, t.filename);
  await fs.access(filePath);

  const { system, user } = extractOmPrompt();
  // OMs typically ship as scanned/visual-heavy PDFs (renderings, tables, maps).
  // Vision path with Opus catches the rent-roll tables more reliably than text.
  const result = await extractWithVision({
    filePath,
    systemPrompt: system,
    userPrompt: user,
    tier: "high-stakes",
    maxTokens: OM_MAX_TOKENS,
    parse: (raw) => OMExtraction.parse(JSON.parse(raw)),
  });
  return {
    source: t.filename,
    extractedAt: new Date().toISOString(),
    model: result.meta.model,
    extractionPath: result.meta.extractionPath,
    latencyMs: result.meta.latencyMs,
    data: result.data,
  };
}

async function extractLease(t: Target): Promise<unknown> {
  const filePath = path.join(PARENT_DIR, t.filename);
  await fs.access(filePath);

  const which = await routeExtraction(filePath);
  const { system, user } = extractLeasePrompt({ knownAddress: t.knownAddress });
  const result =
    which === "text"
      ? await extractWithText({
          filePath,
          systemPrompt: system,
          userPrompt: (text) => `${user}\n\n--- LEASE TEXT START ---\n${text}\n--- LEASE TEXT END ---`,
          tier: "high-stakes",
          maxTokens: LEASE_MAX_TOKENS,
          parse: (raw) => LeaseAbstract.parse(JSON.parse(raw)),
        })
      : await extractWithVision({
          filePath,
          systemPrompt: system,
          userPrompt: user,
          tier: "high-stakes",
          maxTokens: LEASE_MAX_TOKENS,
          parse: (raw) => LeaseAbstract.parse(JSON.parse(raw)),
        });

  return {
    source: t.filename,
    extractedAt: new Date().toISOString(),
    model: result.meta.model,
    extractionPath: result.meta.extractionPath,
    latencyMs: result.meta.latencyMs,
    data: result.data,
  };
}

async function main() {
  const { kinds, only } = parseArgs();
  await fs.mkdir(EXTRACTED_DIR, { recursive: true });

  const queue = TARGETS.filter(
    (t) => kinds.has(t.kind) && (only === null || t.key === only),
  );
  if (queue.length === 0) {
    console.error("No targets matched the filter.");
    process.exit(1);
  }

  console.log(`Pre-extracting ${queue.length} target(s) to ${EXTRACTED_DIR}`);
  for (const t of queue) {
    const outPath = path.join(EXTRACTED_DIR, `${t.key}.json`);
    const started = Date.now();
    process.stdout.write(`  ${t.key.padEnd(20)} `);
    try {
      const payload = t.kind === "om" ? await extractOm(t) : await extractLease(t);
      await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + "\n");
      const ms = Date.now() - started;
      console.log(`ok (${(ms / 1000).toFixed(1)}s) -> ${path.relative(process.cwd(), outPath)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL: ${msg}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
