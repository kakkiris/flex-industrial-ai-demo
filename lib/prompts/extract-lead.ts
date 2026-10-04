import { z } from "zod";

export const TierLabel = z.enum(["tier1", "tier2", "tier3"]);
export type TierLabel = z.infer<typeof TierLabel>;

export const LeadVerdict = z.enum(["qualified", "unqualified", "manual_review"]);
export type LeadVerdict = z.infer<typeof LeadVerdict>;

// Nullable + optional everywhere: the LLM often omits keys it cannot fill,
// even though the prompt says "return null". Accepting undefined here keeps
// the route from 500-ing on every conversation that didn't mention loading
// needs, motivation, etc. Route consumers coerce undefined → null on insert.
export const LeadExtraction = z.object({
  // Tier 1 must-haves
  businessType: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  spaceSizeSqft: z.number().int().positive().nullable().optional(),
  location: z.string().nullable().optional(),
  // Tier 2 capture-if-allows
  timeline: z.string().nullable().optional(),
  leaseTermYears: z.number().positive().nullable().optional(),
  // Tier 3 nice-to-have
  existingLocations: z.string().nullable().optional(),
  motivation: z.string().nullable().optional(),
  loadingNeeds: z.string().nullable().optional(),
  // Operational
  callbackPreferred: z.boolean().optional().default(false),
  phone: z.string().nullable().optional(),
  summary: z.string(),
  // Annotation: which tier each captured field came from. Default to {} so
  // tests + consumers can index without an undefined check.
  tierMap: z.record(z.string(), TierLabel).optional().default({}),
  // Qualification verdict (added 2026-05-27)
  verdict: LeadVerdict,
  confidenceScore: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type LeadExtraction = z.infer<typeof LeadExtraction>;

// Fields submitted by the structured qualification form on the company website. The
// leasing team's own form is the front end now (the conversational chat widget
// was retired); this is the shape the form POSTs to the qualification engine.
export type FormQualificationFields = {
  location: string | null;
  spaceSizeSqft: number | null;
  businessType: string | null;
  businessName: string | null;
  additionalCriteria: string | null;
};

// Serializes the structured website qualification form into a labelled
// block the engine reads. This is the single live qualifier: the KFP fit
// profile and verdict rubric below are the canonical scoring logic (the old
// conversational transcript prompt was retired in the 2026-05-31 L1 reframe).
// Only the input framing is a form (fields instead of a back-and-forth). The
// form supplies Tier 1 directly (location, size, business type and name) and an
// open "additional criteria" field that may volunteer Tier 2/Tier 3 signals
// (timeline, lease term, loading needs, motivation), so the engine still tiers
// and verdicts the same way.
export function buildFormQualificationPrompt(fields: FormQualificationFields): string {
  const lines = [
    `Location of interest: ${fields.location?.trim() || "(not provided)"}`,
    `Desired space size: ${
      fields.spaceSizeSqft != null ? `${fields.spaceSizeSqft} sqft` : "(not provided)"
    }`,
    `Type of business: ${fields.businessType?.trim() || "(not provided)"}`,
    `Business name: ${fields.businessName?.trim() || "(not provided)"}`,
    `Additional criteria: ${fields.additionalCriteria?.trim() || "(not provided)"}`,
  ].join("\n");

  return `You are extracting a structured lead record from a leasing qualification form submitted on the Keystone Flex Partners (KFP) website. KFP is a flex industrial real estate owner. The qualifier uses three tiers; annotate which tier each captured field came from. You also produce a qualification verdict the leasing team uses to triage their inbox.

Read the form submission and return a JSON object that matches this schema:
{
  "businessType": string | null,                  // Tier 1
  "businessName": string | null,                  // Tier 1
  "spaceSizeSqft": integer (sqft) | null,         // Tier 1
  "location": string | null,                      // Tier 1
  "timeline": string | null,                      // Tier 2
  "leaseTermYears": number | null,                // Tier 2
  "existingLocations": string | null,             // Tier 3 ("existing", "new", or free text)
  "motivation": string | null,                    // Tier 3
  "loadingNeeds": string | null,                  // Tier 3 ("dock_high", "grade_level", or free text)
  "callbackPreferred": boolean,
  "phone": string (digits + formatting) | null,
  "summary": string (one to three sentences),
  "tierMap": { "<field name>": "tier1" | "tier2" | "tier3" },
  "verdict": "qualified" | "unqualified" | "manual_review",
  "confidenceScore": integer 0-100,
  "reasoning": string (one sentence explaining the verdict)
}

Capture rules:
- The four named form fields map directly to Tier 1 (businessType, businessName, spaceSizeSqft, location). If a field reads "(not provided)", return null for it and omit it from tierMap.
- The "Additional criteria" field is free text. Read it for any Tier 2 signals (timeline, lease term) and Tier 3 signals (existing locations vs new business, motivation, loading needs) and capture them on the matching field with the correct tier label. If it mentions a callback or a phone number, set callbackPreferred and phone accordingly.
- If a field was never provided, return null for that field and omit it from tierMap.
- "spaceSizeSqft" must be the integer number of square feet. Convert phrases like "two thousand square feet" to 2000.
- "leaseTermYears" must be the number of years. Convert "three years" to 3, "five-year deal" to 5. Decimals for partial years (e.g. 2.5).
- "callbackPreferred" is true if the submission explicitly asked for a callback or said they preferred a phone conversation.
- "phone" must be the contact phone number exactly as provided. Return null if no phone was provided. Keep formatting like dashes and parentheses if used.
- "tierMap" must list every field for which you captured a non-null value, with its tier label.
- Never invent data. Never include budget information.
- "summary" should describe the prospect's situation in plain English without using the word budget.

KFP fit profile (use for verdict):
- Compatible business types (qualified-fit): HVAC, plumbing, electrical and other contractors, distribution, light manufacturing, e-commerce fulfillment, auto services and detailing, metal fabrication, cabinet shops, print shops, warehousing, similar flex industrial tenants.
- Incompatible business types (unqualified): residential tenants, office-only tenants, retail storefronts open to the public, food service open to the public, medical, places of assembly.
- Size band: 500 to 10,000 sqft. Outside this band the lead is unqualified unless ambiguous.
- Locations served: Marisol (Parkhurst, Calder, Brightwater, Ashby Beach, Westbrook) plus expansion markets Kingsley, Orrington, Altamont. Far outside these markets is unqualified.

Verdict rubric:
- "qualified": Tier 1 is fully captured AND at least one Tier 2 field is captured AND the business type fits KFP's profile AND the size is within band AND the location is within KFP's markets.
- "unqualified": business type is clearly incompatible OR the size requirement is outside the 500-10,000 sqft band OR the location is far outside KFP's markets.
- "manual_review": Tier 1 is incomplete OR the business type is ambiguous OR any field is genuinely uncertain.

Confidence score is your confidence in the verdict (0 = total guess, 100 = certain). Use 80+ only when the rubric is unambiguously satisfied.

Reasoning is one sentence explaining the verdict in plain English (e.g. "HVAC contractor needing 2,000 sqft in Brightwater fits KFP's profile cleanly."). Never reference the rubric by name.

Form submission:
${lines}

Respond with only the JSON object, no extra commentary.`;
}
