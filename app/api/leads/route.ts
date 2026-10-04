import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { desc, sql, isNull, eq } from "drizzle-orm";
import { anthropic, pickModel } from "@/lib/anthropic";
import {
  buildFormQualificationPrompt,
  LeadExtraction,
  type FormQualificationFields,
} from "@/lib/prompts/extract-lead";
import { matchUnits } from "@/lib/match-units";
import type { AvailableUnit } from "@/lib/prompts/leasing-chat";
import { notify } from "@/lib/notify";
import { id } from "@/lib/ids";

// Inbox priority: manual_review first (needs human triage), then qualified
// (ready to chase), then unqualified (archive). Within each bucket, newest
// first. Null verdicts (legacy rows from before the 2026-05-27 verdict pass)
// sort with manual_review since the leasing team should look at them.
const VERDICT_RANK_SQL = sql`CASE ${schema.leads.verdict}
  WHEN 'manual_review' THEN 0
  WHEN 'qualified' THEN 1
  WHEN 'unqualified' THEN 2
  ELSE 0
END`;

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(schema.leads)
      .orderBy(VERDICT_RANK_SQL, desc(schema.leads.createdAt))
      .limit(100);
    return NextResponse.json({ data: rows, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

type FormBody = {
  location?: string | null;
  spaceSizeSqft?: number | string | null;
  businessType?: string | null;
  businessName?: string | null;
  additionalCriteria?: string | null;
};

function coerceSqft(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// POST is the structured form-backend intake. The conversational chat widget
// was retired (29-May client feedback); the leasing team's own structured form
// posts here. The qualification engine is unchanged: we serialize the form into
// buildFormQualificationPrompt (same KFP fit profile + verdict rubric as the
// chat path used), run the LLM, parse a LeadExtraction, match the stated need
// against current vacant inventory, persist an enriched source="form" lead with
// the matches attached, and notify the leasing team.
export async function POST(req: Request) {
  try {
    let body: FormBody;
    try {
      body = (await req.json()) as FormBody;
    } catch {
      return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
    }

    const fields: FormQualificationFields = {
      location: body.location ?? null,
      spaceSizeSqft: coerceSqft(body.spaceSizeSqft),
      businessType: body.businessType ?? null,
      businessName: body.businessName ?? null,
      additionalCriteria: body.additionalCriteria ?? null,
    };

    // Reject an entirely empty submission. At least one named field must be
    // present for the engine to have anything to qualify.
    const hasAnyField =
      fields.location ||
      fields.spaceSizeSqft != null ||
      fields.businessType ||
      fields.businessName ||
      fields.additionalCriteria;
    if (!hasAnyField) {
      return NextResponse.json(
        { data: null, error: "At least one form field is required" },
        { status: 400 },
      );
    }

    const prompt = buildFormQualificationPrompt(fields);
    const res = await anthropic().messages.create({
      model: pickModel("default"),
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    const jsonText = firstBalancedJsonObject(text);
    if (!jsonText) {
      return NextResponse.json(
        { data: null, error: "Qualifier returned no JSON" },
        { status: 502 },
      );
    }
    const parsed = LeadExtraction.parse(JSON.parse(jsonText));

    // Match the stated need against current vacant inventory. Vacant units have
    // tenantName NULL (and rentPerSqft NULL on an empty shell), so the matcher
    // ranks on submarket + size band only.
    const vacant = await loadVacantUnits();
    const matched = matchUnits(
      {
        sqft: parsed.spaceSizeSqft ?? fields.spaceSizeSqft,
        submarket: parsed.location ?? fields.location,
        leaseType: null,
      },
      vacant,
    );

    const leadId = id("lead");
    db.insert(schema.leads)
      .values({
        id: leadId,
        source: "form",
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
        // The structured submission is stored as the raw payload so the inbox
        // can render the five fields the prospect filled in.
        rawTranscript: serializeFormSubmission(fields),
        tierMap: parsed.tierMap ? JSON.stringify(parsed.tierMap) : null,
        // Qualification verdict
        verdict: parsed.verdict,
        confidenceScore: parsed.confidenceScore,
        reasoning: parsed.reasoning,
        // Matched vacant units attached to the enriched lead.
        matchedUnits: JSON.stringify(matched),
        createdAt: new Date(),
      })
      .run();

    const headline =
      [parsed.businessName, parsed.businessType].filter(Boolean).join(", ") ||
      "New leasing lead";
    await notify({
      kind: "qualified_lead",
      title: headline,
      body: parsed.summary,
      link: "/chat-leasing",
    });

    return NextResponse.json({
      data: { leadId, lead: parsed, matchedUnits: matched },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[leads POST] error:", message, err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

// Loads the current vacant inventory in the AvailableUnit shape the matcher and
// match-display reuse. A unit is vacant iff tenantName IS NULL. Empty shells
// carry rentPerSqft NULL, so we default it to 0 (the matcher ignores rent).
async function loadVacantUnits(): Promise<AvailableUnit[]> {
  const rows = await db
    .select({
      propertyName: schema.properties.name,
      submarket: schema.properties.submarket,
      suite: schema.units.suite,
      sizeSqft: schema.units.sizeSqft,
      rentPerSqft: schema.units.rentPerSqft,
      leaseType: schema.units.leaseType,
    })
    .from(schema.units)
    .innerJoin(schema.properties, eq(schema.properties.id, schema.units.propertyId))
    .where(isNull(schema.units.tenantName))
    .limit(200);

  return rows
    .filter((r) => r.propertyName && r.submarket && r.suite && r.sizeSqft && r.leaseType)
    .map((r) => ({
      propertyName: r.propertyName as string,
      submarket: r.submarket as string,
      suite: r.suite as string,
      sizeSqft: r.sizeSqft as number,
      rentPerSqft: typeof r.rentPerSqft === "number" ? r.rentPerSqft : 0,
      leaseType: r.leaseType as string,
    }));
}

// Renders the five form fields into the labelled block stored on the lead so
// the inbox can show exactly what the prospect submitted.
function serializeFormSubmission(fields: FormQualificationFields): string {
  return [
    `Location: ${fields.location?.trim() || "(not provided)"}`,
    `Square footage: ${fields.spaceSizeSqft != null ? `${fields.spaceSizeSqft} sqft` : "(not provided)"}`,
    `Business type: ${fields.businessType?.trim() || "(not provided)"}`,
    `Business name: ${fields.businessName?.trim() || "(not provided)"}`,
    `Additional criteria: ${fields.additionalCriteria?.trim() || "(not provided)"}`,
  ].join("\n");
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
