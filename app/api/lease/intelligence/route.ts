import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { anthropic, pickModel, logLLM, estimateCost } from "@/lib/anthropic";
import {
  retrieveLeaseSections,
  retrieveAvailability,
  queryIsAvailability,
} from "@/lib/retrieval";
import {
  leaseIntelligencePrompt,
  LeaseAnswer,
  type LeaseIntelligenceContext,
} from "@/lib/prompts/lease-intelligence";
import { id } from "@/lib/ids";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const body = (await req.json()) as { query?: string; leaseId?: string | null };
    if (!body.query || typeof body.query !== "string") {
      return NextResponse.json({ data: null, error: "query required" }, { status: 400 });
    }
    const scopedLeaseId = typeof body.leaseId === "string" && body.leaseId.length > 0 ? body.leaseId : null;
    const sections = await retrieveLeaseSections(body.query, { k: 8, leaseId: scopedLeaseId });

    // D.3: availability ("what is empty and rentable") side path. On
    // availability intent (and only when not scoped to a single lease), surface
    // the vacant units as additional answer context. Kept as a distinct
    // "Available Unit (system)" context entry so the citation list does not mix
    // shapes confusingly with lease sections.
    const availabilityContext: LeaseIntelligenceContext[] = [];
    if (!scopedLeaseId && queryIsAvailability(body.query)) {
      const vacant = await retrieveAvailability(body.query);
      for (const u of vacant) {
        const where = [u.propertyName, u.propertyAddress].filter(Boolean).join(", ");
        availabilityContext.push({
          leaseId: u.unitId,
          tenantName: null,
          section: "Available Unit (system)",
          page: 0,
          text:
            `Available (vacant, rentable) unit. ${where ? `Property: ${where}. ` : ""}` +
            `Suite: ${u.suite ?? "n/a"}. Size: ${u.sizeSqft ?? "unknown"} square feet. ` +
            `Lease type: ${u.leaseType ?? "n/a"}. This unit is empty and available to rent.`,
        });
      }
    }

    const retrieved: LeaseIntelligenceContext[] = [...availabilityContext, ...sections];

    if (retrieved.length === 0) {
      const ms = Date.now() - started;
      const empty: typeof LeaseAnswer._output = {
        answer:
          "I do not have any lease sections that look relevant to that question. Try rephrasing or narrowing the question.",
        citations: [],
        table: null,
        schedule: null,
      };
      await db.insert(schema.queryLog).values({
        id: id("q"),
        query: body.query,
        response: JSON.stringify(empty),
        citations: JSON.stringify([]),
        responseTimeMs: ms,
        timestamp: new Date(),
      });
      return NextResponse.json({ data: { ...empty, responseTimeMs: ms }, error: null });
    }

    const { system, user } = leaseIntelligencePrompt({ query: body.query, context: retrieved });
    const model = pickModel("default");
    const res = await anthropic().messages.create({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    const jsonText = firstBalancedJsonObject(text);
    if (!jsonText) {
      return NextResponse.json({ data: null, error: "Intelligence returned no JSON" }, { status: 502 });
    }
    const answer = LeaseAnswer.parse(JSON.parse(jsonText));
    const responseTimeMs = Date.now() - started;

    logLLM({
      model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      latencyMs: responseTimeMs,
      estCostUsd: estimateCost(model, res.usage.input_tokens, res.usage.output_tokens),
    });

    await db.insert(schema.queryLog).values({
      id: id("q"),
      query: body.query,
      response: JSON.stringify(answer),
      citations: JSON.stringify(answer.citations),
      responseTimeMs,
      timestamp: new Date(),
    });

    return NextResponse.json({ data: { ...answer, responseTimeMs }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lease/intelligence] error:", message);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

function firstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0,
    inString = false,
    escape = false;
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
