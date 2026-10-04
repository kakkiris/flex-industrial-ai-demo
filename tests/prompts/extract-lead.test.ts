import { describe, it, expect } from "vitest";
import {
  LeadExtraction,
  buildFormQualificationPrompt,
} from "@/lib/prompts/extract-lead";

const validRecord = {
  // Tier 1
  businessType: "HVAC contractor",
  businessName: "Miller Brothers HVAC LLC",
  spaceSizeSqft: 1800,
  location: "Calder",
  // Tier 2
  timeline: "August",
  leaseTermYears: 5,
  // Tier 3
  existingLocations: "existing",
  motivation: "outgrew current shop",
  loadingNeeds: "grade_level",
  callbackPreferred: false,
  summary: "Small HVAC firm looking for a 1800 sqft NNN bay in Calder this summer.",
  tierMap: {
    businessType: "tier1" as const,
    businessName: "tier1" as const,
    spaceSizeSqft: "tier1" as const,
    location: "tier1" as const,
    timeline: "tier2" as const,
    leaseTermYears: "tier2" as const,
    existingLocations: "tier3" as const,
    motivation: "tier3" as const,
    loadingNeeds: "tier3" as const,
  },
  verdict: "qualified" as const,
  confidenceScore: 88,
  reasoning: "HVAC contractor needing 1800 sqft in Calder fits KFP's profile cleanly.",
};

describe("LeadExtraction schema", () => {
  it("accepts a fully populated record", () => {
    const parsed = LeadExtraction.parse(validRecord);
    expect(parsed.businessType).toBe("HVAC contractor");
    expect(parsed.spaceSizeSqft).toBe(1800);
    expect(parsed.leaseTermYears).toBe(5);
    expect(parsed.tierMap.timeline).toBe("tier2");
  });

  it("accepts nulls on optional fields with an empty tierMap", () => {
    const parsed = LeadExtraction.parse({
      businessType: null,
      businessName: null,
      spaceSizeSqft: null,
      location: null,
      timeline: null,
      leaseTermYears: null,
      existingLocations: null,
      motivation: null,
      loadingNeeds: null,
      callbackPreferred: true,
      summary: "Caller hung up before sharing details; requested a callback.",
      tierMap: {},
      verdict: "manual_review" as const,
      confidenceScore: 20,
      reasoning: "No qualifying fields captured before disconnect.",
    });
    expect(parsed.callbackPreferred).toBe(true);
    expect(Object.keys(parsed.tierMap)).toHaveLength(0);
  });

  it("rejects negative spaceSizeSqft", () => {
    expect(() =>
      LeadExtraction.parse({ ...validRecord, spaceSizeSqft: -10 })
    ).toThrow();
  });

  it("rejects non-integer spaceSizeSqft", () => {
    expect(() =>
      LeadExtraction.parse({ ...validRecord, spaceSizeSqft: 1234.5 })
    ).toThrow();
  });

  it("rejects negative leaseTermYears", () => {
    expect(() =>
      LeadExtraction.parse({ ...validRecord, leaseTermYears: -1 })
    ).toThrow();
  });

  it("rejects an unknown tier label in tierMap", () => {
    expect(() =>
      LeadExtraction.parse({
        ...validRecord,
        tierMap: { businessType: "tier99" as unknown as "tier1" },
      })
    ).toThrow();
  });
});

describe("buildFormQualificationPrompt", () => {
  const fields = {
    location: "Brightwater",
    spaceSizeSqft: 1800,
    businessType: "HVAC contractor",
    businessName: "Miller Brothers HVAC LLC",
    additionalCriteria: "Need to move in by August, 5-year term, grade-level loading.",
  };

  it("embeds the submitted form fields", () => {
    const prompt = buildFormQualificationPrompt(fields);
    expect(prompt).toContain("Brightwater");
    expect(prompt).toContain("1800 sqft");
    expect(prompt).toContain("HVAC contractor");
    expect(prompt).toContain("Miller Brothers HVAC LLC");
    expect(prompt).toContain("grade-level loading");
  });

  it("marks missing fields as not provided rather than inventing data", () => {
    const prompt = buildFormQualificationPrompt({
      location: null,
      spaceSizeSqft: null,
      businessType: null,
      businessName: null,
      additionalCriteria: null,
    });
    expect(prompt).toContain("(not provided)");
  });

  it("instructs JSON-only output", () => {
    const prompt = buildFormQualificationPrompt(fields).toLowerCase();
    expect(prompt).toContain("json");
  });

  it("documents the three-tier schema", () => {
    const prompt = buildFormQualificationPrompt(fields);
    expect(prompt).toMatch(/tier1/);
    expect(prompt).toMatch(/tier2/);
    expect(prompt).toMatch(/tier3/);
  });

  it("keeps the KFP fit profile and verdict rubric verbatim", () => {
    // The engine (fit profile + rubric) must stay identical between the
    // transcript and form variants. Spot-check load-bearing lines.
    const formPrompt = buildFormQualificationPrompt(fields);
    expect(formPrompt).toContain("KFP fit profile (use for verdict):");
    expect(formPrompt).toContain(
      "Size band: 500 to 10,000 sqft. Outside this band the lead is unqualified unless ambiguous.",
    );
    expect(formPrompt).toContain('Verdict rubric:');
    expect(formPrompt).toContain(
      'Confidence score is your confidence in the verdict (0 = total guess, 100 = certain). Use 80+ only when the rubric is unambiguously satisfied.',
    );
  });

  it("does not mention budget", () => {
    const prompt = buildFormQualificationPrompt(fields).toLowerCase();
    expect(prompt).not.toMatch(/capture.*budget|budget range|budget.*per sqft/);
  });
});
