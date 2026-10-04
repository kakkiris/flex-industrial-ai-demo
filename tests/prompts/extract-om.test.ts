import { describe, it, expect } from "vitest";
import { OMExtraction, extractOmPrompt } from "@/lib/prompts/extract-om";

const minimalValid: OMExtraction = {
  property: {
    name: "Westside Flex Center",
    address: "1234 Industrial Way, Tolland, TX 77601",
    submarket: "Tolland",
    state: "TX",
    totalSqft: 45000,
    assetType: "flex industrial",
    yearBuilt: 2005,
    zipCode: "77601",
    county: "Hollis",
    hasOffice: true,
    clearHeightFt: 24,
  },
  units: [
    {
      suite: "101",
      sizeSqft: 2000,
      tenantName: "HVAC Contractor",
      tenantCategory: "HVAC contractor",
      leaseType: "NNN",
      currentRent: 2200,
      rentPerSqft: 13.2,
      leaseStart: "2024-01-01",
      leaseEnd: "2029-01-01",
      hasPrivateBathroom: true,
      rawQuote: "Suite 101 shall pay $13.20 per square foot annually.",
      extractedFromPage: 12,
    },
  ],
  confidence: {
    "property.name": { level: "high", reason: "Stated on cover page" },
    "units.101.rent": { level: "medium", reason: "From rent roll table page 12" },
  },
};

describe("OMExtraction schema", () => {
  it("parses a minimal valid input", () => {
    const parsed = OMExtraction.parse(minimalValid);
    expect(parsed.property.name).toBe("Westside Flex Center");
    expect(parsed.units).toHaveLength(1);
    expect(parsed.units[0].leaseType).toBe("NNN");
  });

  it("accepts all nullable fields as null", () => {
    const parsed = OMExtraction.parse({
      ...minimalValid,
      units: [
        {
          suite: null,
          sizeSqft: null,
          tenantName: null,
          tenantCategory: null,
          leaseType: null,
          currentRent: null,
          rentPerSqft: null,
          leaseStart: null,
          leaseEnd: null,
          hasPrivateBathroom: null,
          rawQuote: null,
          extractedFromPage: null,
        },
      ],
    });
    expect(parsed.units[0].leaseType).toBeNull();
  });

  it("rejects an invalid leaseType value", () => {
    expect(() =>
      OMExtraction.parse({
        ...minimalValid,
        units: [{ ...minimalValid.units[0], leaseType: "Full Service" }],
      })
    ).toThrow();
  });

  it("rejects a non-integer yearBuilt", () => {
    expect(() =>
      OMExtraction.parse({
        ...minimalValid,
        property: { ...minimalValid.property, yearBuilt: 2005.5 },
      })
    ).toThrow();
  });

  it("accepts an empty units array", () => {
    const parsed = OMExtraction.parse({ ...minimalValid, units: [] });
    expect(parsed.units).toHaveLength(0);
  });
});

describe("extractOmPrompt", () => {
  it("returns non-empty system and user strings", () => {
    const { system, user } = extractOmPrompt();
    expect(system.length).toBeGreaterThan(0);
    expect(user.length).toBeGreaterThan(0);
  });

  it("system string contains 'Offering Memorandum'", () => {
    const { system } = extractOmPrompt();
    expect(system).toContain("Offering Memorandum");
  });

  it("user string contains 'property'", () => {
    const { user } = extractOmPrompt();
    expect(user).toContain("property");
  });
});
