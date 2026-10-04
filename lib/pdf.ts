import { extractText, getDocumentProxy } from "unpdf";
import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import {
  anthropic,
  logLLM,
  estimateCost,
  pickModel,
  type Tier,
} from "./anthropic";

export type ExtractedPage = { page: number; text: string };

export async function extractPdfText(filePath: string): Promise<ExtractedPage[]> {
  const buf = await fs.readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  // extractText with mergePages: false returns { totalPages, text: string[] }
  // where text[i] is the text for page i+1 (0-indexed array, 1-indexed pages).
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((t, i) => ({ page: i + 1, text: t }));
}

export type ExtractionPath = "text" | "vision";

// Decides whether a PDF should be processed via the text path or the vision
// path by probing page 1's extractable text density. The KFP form lease is
// text-native (DocuSign-executed) and clears the threshold trivially. The
// legacy scanned lease ships as full-page CCITT gray images; unpdf returns
// near-zero characters and we fall through to vision.
export async function routeExtraction(
  filePath: string,
  threshold: number = 200
): Promise<ExtractionPath> {
  try {
    const pages = await extractPdfText(filePath);
    const page1 = pages[0]?.text ?? "";
    return page1.trim().length >= threshold ? "text" : "vision";
  } catch {
    // If text extraction itself blows up (corrupt or weird-encoded PDF),
    // fall back to vision; Anthropic's document support handles a wider mix.
    return "vision";
  }
}

export type VisionArgs<T> = {
  filePath: string;
  systemPrompt: string;
  userPrompt: string;
  tier?: Tier;
  maxTokens?: number;
  parse: (jsonText: string) => T;
};

export type VisionResult<T> = {
  data: T;
  meta: { model: string; latencyMs: number; extractionPath?: ExtractionPath };
};

export type TextExtractArgs<T> = {
  filePath: string;
  systemPrompt: string;
  userPrompt: (text: string) => string;
  tier?: Tier;
  maxTokens?: number;
  parse: (jsonText: string) => T;
};

// Extracts structured data via the text path: pulls all pages with unpdf,
// joins them, and sends as a regular text message to Claude. Use this when
// routeExtraction returns "text" (text-native PDFs like the KFP form lease).
export async function extractWithText<T>(args: TextExtractArgs<T>): Promise<VisionResult<T>> {
  const pages = await extractPdfText(args.filePath);
  const joined = pages
    .map((p) => `[page ${p.page}]\n${p.text}`)
    .join("\n\n");
  const model = pickModel(args.tier ?? "default");
  const started = Date.now();

  const res = await anthropic().messages.create({
    model,
    max_tokens: args.maxTokens ?? 8000,
    system: args.systemPrompt,
    messages: [{ role: "user", content: args.userPrompt(joined) }],
  });

  const latencyMs = Date.now() - started;
  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");

  const jsonText = firstBalancedJsonObject(text);
  if (!jsonText) {
    throw new Error("No JSON object found in LLM response (text path)");
  }
  const data = args.parse(jsonText);

  logLLM({
    model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    latencyMs,
    estCostUsd: estimateCost(model, res.usage.input_tokens, res.usage.output_tokens),
  });

  return { data, meta: { model, latencyMs, extractionPath: "text" } };
}

export async function extractWithVision<T>(args: VisionArgs<T>): Promise<VisionResult<T>> {
  const buf = await fs.readFile(args.filePath);
  const base64 = buf.toString("base64");
  const model = pickModel(args.tier ?? "default");
  const maxTokens = args.maxTokens ?? 8000;
  const started = Date.now();

  // The Anthropic SDK refuses non-streaming responses when max_tokens is large
  // enough that the request could exceed 10 minutes. Vision + Opus + a long
  // rent roll easily trips this, so we always stream when maxTokens is above
  // the non-streaming safe ceiling and accumulate to a single text string.
  const useStreaming = maxTokens > 8000;
  const params = {
    model,
    max_tokens: maxTokens,
    system: args.systemPrompt,
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
          },
          { type: "text" as const, text: args.userPrompt },
        ],
      },
    ],
  };

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

  if (useStreaming) {
    const stream = anthropic().messages.stream(params);
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    inputTokens = final.usage.input_tokens;
    outputTokens = final.usage.output_tokens;
  } else {
    const res = await anthropic().messages.create(params);
    text = res.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    inputTokens = res.usage.input_tokens;
    outputTokens = res.usage.output_tokens;
  }

  const latencyMs = Date.now() - started;
  const jsonText = firstBalancedJsonObject(text);
  if (!jsonText) {
    throw new Error("No JSON object found in LLM response (vision path)");
  }
  const data = args.parse(jsonText);

  logLLM({
    model,
    inputTokens,
    outputTokens,
    latencyMs,
    estCostUsd: estimateCost(model, inputTokens, outputTokens),
  });

  return { data, meta: { model, latencyMs, extractionPath: "vision" } };
}

// Walks the text looking for the first `{` then tracks brace depth (respecting
// JSON string literals and escape sequences) until depth returns to zero,
// returning the balanced object substring. Returns null if no balanced object
// is found. Shared between the text and vision extraction paths.
function firstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export async function savePdfToUploads(file: File, subdir: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "uploads", subdir);
  await fs.mkdir(dir, { recursive: true });
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
  const filename = `${Date.now()}-${safe}`;
  const full = path.join(dir, filename);
  await fs.writeFile(full, buf);
  return path.relative(process.cwd(), full);
}
