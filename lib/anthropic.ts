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

// Rough cost per 1M tokens (input, output) for log-only estimates. These are
// approximate published list prices and exist to flag runaway calls during the
// demo build, not to bill anyone. Update if Anthropic publishes new tiers.
const COSTS: Record<string, [number, number]> = {
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-4-7": [15, 75],
  "claude-haiku-4-5-20251001": [1, 5],
};

export function estimateCost(model: string, input: number, output: number): number {
  const [ic, oc] = COSTS[model] ?? [0, 0];
  return (input / 1_000_000) * ic + (output / 1_000_000) * oc;
}

export function logLLM(meta: LLMCallMeta): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[LLM] model=${meta.model} in=${meta.inputTokens} out=${meta.outputTokens} ` +
      `${meta.latencyMs}ms ~$${meta.estCostUsd.toFixed(4)}`
    );
  }
}
