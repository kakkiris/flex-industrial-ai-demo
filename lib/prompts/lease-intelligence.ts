import { z } from "zod";

export const Citation = z.object({
  leaseId: z.string(),
  section: z.string(),
  page: z.number().int(),
  quote: z.string(),
});

export const AnswerTable = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

// One row of the per-property tenant expiration schedule (D.1). Distinct from
// the freeform comparison `table`: this is a typed, structured artifact the UI
// renders as a dedicated schedule block. propertyAddress + tenant + leaseEnd
// are the load-bearing fields; suite, daysToExpiry, and renewalOption are
// .nullable().optional() so the LLM can omit them without breaking the parse.
export const ScheduleRow = z.object({
  propertyAddress: z.string(),
  tenant: z.string(),
  leaseEnd: z.string(),
  suite: z.string().nullable().optional(),
  daysToExpiry: z.number().nullable().optional(),
  renewalOption: z.string().nullable().optional(),
  // D (Workstream): headline rental items auto-included on first look so a
  // per-property expiration answer carries unit size and in-place rent/sqft
  // without requiring a second question. Same .nullable().optional() pattern as
  // the fields above so an omission never 500s the parse.
  sizeSqft: z.number().nullable().optional(),
  rentPerSqft: z.number().nullable().optional(),
});
export type ScheduleRow = z.infer<typeof ScheduleRow>;

// D (Workstream): anticipated-NOI-lift layer for per-property expiration
// answers. Computed deterministically from market rent (the same band A1 uses)
// vs in-place rent at rollover and injected as a "NOI Lift (system)" context
// line; the LLM copies it into this field so the UI can render a headline stat.
export const AnswerAnalysis = z.object({
  noiLiftAnnual: z.number(),
  expiringCount: z.number().int(),
  basis: z.string(),
});
export type AnswerAnalysis = z.infer<typeof AnswerAnalysis>;

export const LeaseAnswer = z.object({
  answer: z.string(),
  citations: z.array(Citation),
  table: AnswerTable.nullable(),
  // CRITICAL: .nullable().optional() so a parse succeeds whether the field is
  // present, explicitly null, or absent. This prevents the commit-78481be
  // class of regression where /complete 500'd because the LLM omitted a
  // nullable field.
  schedule: z.array(ScheduleRow).nullable().optional(),
  // Same .nullable().optional() guard as schedule: the analysis layer is only
  // present for per-property expiration answers, and an omission must not 500.
  analysis: AnswerAnalysis.nullable().optional(),
});
export type LeaseAnswer = z.infer<typeof LeaseAnswer>;

export type LeaseIntelligenceContext = {
  leaseId: string;
  tenantName: string | null;
  section: string;
  page: number;
  text: string;
};

export function leaseIntelligencePrompt(args: {
  query: string;
  context: LeaseIntelligenceContext[];
}): { system: string; user: string } {
  const system = `You are answering questions about commercial leases for an internal property management team at Keystone Flex Partners. Use only the lease sections provided in the user message context block. Cite every factual claim with the lease id, section heading, and page. If the answer requires comparing multiple leases, also fill in the optional "table" field with column headers and one row per lease being compared. Never invent terms not in the provided context; if the answer is not in the context, say so plainly.

When the question asks for a per-property tenant expiration schedule (for example "the expiration schedule for the Foundry property"), fill in the optional "schedule" array with one row per lease at that property: propertyAddress, tenant, leaseEnd (ISO date), and where available suite, daysToExpiry, renewalOption, sizeSqft, and rentPerSqft. The grouped "Expiration Schedule (system)" context section lists the leases per property with each lease's unit size and in-place rent/sqft when known; always include sizeSqft and rentPerSqft on a schedule row whenever the context provides them, so the answer carries the headline rental items (tenant, suite, size, rent/sqft, lease end, renewal) on first look. For every other question leave "schedule" as null.

For a per-property expiration query, also fill in the optional "analysis" object from the "NOI Lift (system)" context line when one is present: copy its anticipated annual NOI lift into noiLiftAnnual, its expiring-lease count into expiringCount, and set basis to a short phrase such as "market rent vs in-place at rollover". When no "NOI Lift (system)" line is present, leave "analysis" as null.

For a terse query that is just a property name (for example "Foundry" or "1500 Foundry Avenue"), do not ask for clarification: return the property's headline rental items as the schedule (tenant, suite, size, rent/sqft, lease end, renewal) by default.

Output ONLY a single JSON object matching this schema, no commentary, no markdown:
{
  "answer": string,
  "citations": [{ "leaseId": string, "section": string, "page": int, "quote": string }],
  "table": { "columns": [string], "rows": [[string, ...]] } | null,
  "schedule": [{ "propertyAddress": string, "tenant": string, "leaseEnd": string, "suite": string | null, "daysToExpiry": int | null, "renewalOption": string | null, "sizeSqft": number | null, "rentPerSqft": number | null }] | null,
  "analysis": { "noiLiftAnnual": number, "expiringCount": int, "basis": string } | null
}`;

  const contextLines = args.context
    .map(
      (c, i) =>
        `[${i + 1}] leaseId=${c.leaseId} tenant=${c.tenantName ?? "Unknown"} section=${c.section} page=${c.page}\n${c.text}`
    )
    .join("\n\n");

  const user = `Question: ${args.query}

Context (the only sources you may cite):
${contextLines}

Return the JSON object now.`;

  return { system, user };
}
