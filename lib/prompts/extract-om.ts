import { z } from "zod";
import { ConfidenceMap } from "@/lib/confidence";

export const OMProperty = z.object({
  name: z.string(),
  address: z.string().nullable(),
  submarket: z.string().nullable(),
  state: z.string().nullable(),
  totalSqft: z.number().int().nullable(),
  assetType: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  zipCode: z.string().nullable(),
  county: z.string().nullable(),
  hasOffice: z.boolean().nullable(),
  clearHeightFt: z.number().nullable(),
});

export const OMUnit = z.object({
  suite: z.string().nullable(),
  sizeSqft: z.number().int().nullable(),
  tenantName: z.string().nullable(),
  tenantCategory: z.string().nullable(),         // industry category inferred from tenant name
  leaseType: z.enum(["NNN", "MG", "Gross"]).nullable(),
  currentRent: z.number().nullable(),            // monthly $
  rentPerSqft: z.number().nullable(),            // annual $/sqft
  leaseStart: z.string().nullable(),             // ISO
  leaseEnd: z.string().nullable(),               // ISO
  hasPrivateBathroom: z.boolean().nullable(),
  rawQuote: z.string().nullable(),               // verbatim excerpt
  extractedFromPage: z.number().int().nullable(),
});

export const OMExtraction = z.object({
  property: OMProperty,
  units: z.array(OMUnit),
  confidence: ConfidenceMap,
});
export type OMExtraction = z.infer<typeof OMExtraction>;

export function extractOmPrompt(): { system: string; user: string } {
  const system = `You are extracting structured property and rent roll data from a commercial real estate Offering Memorandum (OM). The OM is attached as a PDF. Output ONLY a single JSON object matching the schema described in the user message. Do not add commentary, do not wrap the JSON in markdown fences.

Rules:
- Never invent data. If a field is not present in the OM, set it to null.
- Prefer per-unit detail from the rent roll over aggregated stabilized rents. If the OM only shows aggregates, return one unit with the aggregate and mark the rent confidence as "low".
- For dates, use ISO-8601.
- For rents, currentRent is the MONTHLY dollar amount; rentPerSqft is the ANNUAL dollar amount per square foot.
- For each unit row, include a short rawQuote (one sentence) copied verbatim from the OM showing where you found the rent, and the page number.
- Mark CoStar-style estimates as "low" confidence in the confidence map.`;

  const user = `Extract the property and rent roll from the attached Offering Memorandum.

Return JSON with this shape:
{
  "property": {
    "name": string,
    "address": string | null,
    "submarket": string | null,
    "state": string | null,
    "totalSqft": int | null,
    "assetType": string | null,
    "yearBuilt": int | null,
    "zipCode": string | null,
    "county": string | null,
    "hasOffice": boolean | null,
    "clearHeightFt": number | null
  },
  "units": [
    {
      "suite": string | null,
      "sizeSqft": int | null,
      "tenantName": string | null,
      "tenantCategory": string | null,
      "leaseType": "NNN" | "MG" | "Gross" | null,
      "currentRent": number | null,
      "rentPerSqft": number | null,
      "leaseStart": "YYYY-MM-DD" | null,
      "leaseEnd": "YYYY-MM-DD" | null,
      "hasPrivateBathroom": boolean | null,
      "rawQuote": string | null,
      "extractedFromPage": int | null
    }
  ],
  "confidence": { "<field-path>": { "level": "high" | "medium" | "low", "reason": string } }
}

Notes on the new fields:
- zipCode + county come from the property address. Leave null if not stated.
- hasOffice is property-level: true if the OM mentions office space (build-out, finished offices, suites with offices). null if not addressed.
- clearHeightFt: capture the clear height in feet if stated in the OM (often called "clear height", "ceiling height", or "deck height"). Property-level value; if mixed, use the lower bound.
- tenantCategory per unit: short business-type tag inferred from the tenant entity name (e.g., "HVAC contractor", "auto services", "e-commerce fulfillment", "light manufacturing", "distribution", "metal fabrication"). null for vacant units.`;
  return { system, user };
}
