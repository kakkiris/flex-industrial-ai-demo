import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { anthropic, pickModel } from "@/lib/anthropic";
import { extractLeadPrompt } from "@/lib/prompts/leasing-chat-original";
import { LeadExtraction } from "@/lib/prompts/extract-lead";
import { notify } from "@/lib/notify";
import { id } from "@/lib/ids";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId?: string; transcript?: ChatMessage[] };
    if (!body.transcript || !Array.isArray(body.transcript)) {
      return NextResponse.json({ data: null, error: "transcript required" }, { status: 400 });
    }
    const transcriptText = body.transcript
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = extractLeadPrompt(transcriptText);
    const res = await anthropic().messages.create({
      model: pickModel("default"),
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    // Extract the first balanced JSON object from the LLM response. A naive
    // greedy regex would grab from the first `{` to the last `}`, which fails
    // when the model emits any second JSON-like blob (e.g. a stray plan).
    const jsonText = firstBalancedJsonObject(text);
    if (!jsonText) {
      return NextResponse.json({ data: null, error: "Extractor returned no JSON" }, { status: 502 });
    }
    const parsed = LeadExtraction.parse(JSON.parse(jsonText));

    const leadId = id("lead");
    // Wrap both inserts in a transaction so a chatSessions failure does not
    // leave an orphan lead row in the DB.
    db.transaction((tx) => {
      tx.insert(schema.leads).values({
        id: leadId,
        source: "chat",
        // Tier 1: coerce undefined to null since the LLM may omit keys.
        businessType: parsed.businessType ?? null,
        businessName: parsed.businessName ?? null,
        spaceSizeSqft: parsed.spaceSizeSqft ?? null,
        location: parsed.location ?? null,
        // Tier 2
        timeline: parsed.timeline ?? null,
        leaseTermYears: parsed.leaseTermYears ?? null,
        // Tier 3
        existingLocations: parsed.existingLocations ?? null,
        motivation: parsed.motivation ?? null,
        loadingNeeds: parsed.loadingNeeds ?? null,
        // Operational
        callbackPreferred: parsed.callbackPreferred ?? false,
        phone: parsed.phone ?? null,
        rawTranscript: transcriptText,
        tierMap: parsed.tierMap ? JSON.stringify(parsed.tierMap) : null,
        // Qualification verdict
        verdict: parsed.verdict,
        confidenceScore: parsed.confidenceScore,
        reasoning: parsed.reasoning,
        createdAt: new Date(),
      }).run();
      tx.insert(schema.chatSessions).values({
        id: id("cs"),
        leadId,
        startedAt: new Date(),
        endedAt: new Date(),
        transcript: JSON.stringify(body.transcript),
      }).run();
    });
    const headline = [parsed.businessName, parsed.businessType].filter(Boolean).join(", ") || "New leasing lead";
    await notify({
      kind: "qualified_lead",
      title: headline,
      body: parsed.summary,
      link: "/chat-leasing",
    });

    return NextResponse.json({ data: { leadId, lead: parsed }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat/leasing/complete] error:", message, err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

// Walks the text looking for the first `{` then tracks brace depth (respecting
// JSON string literals and escape sequences) until depth returns to zero,
// returning the balanced object substring. Returns null if no balanced object
// is found.
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
