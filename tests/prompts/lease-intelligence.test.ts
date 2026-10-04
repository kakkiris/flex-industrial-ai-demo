import { describe, it, expect } from "vitest";
import { LeaseAnswer, leaseIntelligencePrompt } from "@/lib/prompts/lease-intelligence";

describe("LeaseAnswer schema", () => {
  it("accepts a valid response without a table", () => {
    const parsed = LeaseAnswer.parse({
      answer: "HVAC is the tenant's responsibility.",
      citations: [{ leaseId: "lease_1", section: "7. Maintenance", page: 12, quote: "Tenant maintains HVAC ..." }],
      table: null,
    });
    expect(parsed.table).toBeNull();
  });
  it("accepts a valid response with a comparison table", () => {
    const parsed = LeaseAnswer.parse({
      answer: "See table",
      citations: [],
      table: { columns: ["Tenant", "Term"], rows: [["Acme", "5y"], ["Beta", "3y"]] },
    });
    expect(parsed.table?.rows).toHaveLength(2);
  });
  it("rejects an empty answer? (current schema allows empty strings, so this passes)", () => {
    expect(LeaseAnswer.parse({ answer: "", citations: [], table: null }).answer).toBe("");
  });

  // D.1: the optional per-property expiration schedule. The field is
  // .nullable().optional() so a parse succeeds whether the LLM returns the
  // field populated, returns it explicitly null, or omits it entirely. This
  // prevents the L1 commit-78481be class of regression (a /complete 500 when
  // the LLM omitted a nullable field).
  it("accepts a response WITH a populated schedule", () => {
    const parsed = LeaseAnswer.parse({
      answer: "Here is the expiration schedule for the Foundry property.",
      citations: [],
      table: null,
      schedule: [
        {
          propertyAddress: "1500 Foundry Avenue, Olmstead, TX 78475",
          tenant: "Brightline Lighting Supply Inc",
          suite: "A1",
          leaseEnd: "2028-12-31",
          daysToExpiry: 945,
          renewalOption: "None on record",
        },
      ],
    });
    expect(parsed.schedule).toHaveLength(1);
    expect(parsed.schedule?.[0].tenant).toBe("Brightline Lighting Supply Inc");
  });

  it("accepts a response with schedule explicitly null", () => {
    const parsed = LeaseAnswer.parse({
      answer: "HVAC is the tenant's responsibility.",
      citations: [],
      table: null,
      schedule: null,
    });
    expect(parsed.schedule).toBeNull();
  });

  it("accepts a response with the schedule field ABSENT (the no-500 guarantee)", () => {
    const parsed = LeaseAnswer.parse({
      answer: "HVAC is the tenant's responsibility.",
      citations: [],
      table: null,
    });
    // Absent is fine: the field is optional, so no parse error is thrown.
    expect(parsed.schedule ?? null).toBeNull();
  });

  it("accepts a schedule row with nullable fields omitted", () => {
    const parsed = LeaseAnswer.parse({
      answer: "Partial schedule.",
      citations: [],
      table: null,
      schedule: [
        {
          propertyAddress: "1500 Foundry Avenue, Olmstead, TX 78475",
          tenant: "KTR Roofing LLC",
          leaseEnd: "2029-05-31",
        },
      ],
    });
    expect(parsed.schedule?.[0].suite ?? null).toBeNull();
    expect(parsed.schedule?.[0].daysToExpiry ?? null).toBeNull();
    expect(parsed.schedule?.[0].renewalOption ?? null).toBeNull();
  });
});

describe("ScheduleRow + analysis enrichment", () => {
  it("accepts size and rent per sqft on a schedule row", () => {
    const parsed = LeaseAnswer.parse({
      answer: "schedule", citations: [], table: null,
      schedule: [{ propertyAddress: "1500 Foundry Avenue", tenant: "Acme", leaseEnd: "2027-06-30", sizeSqft: 2400, rentPerSqft: 18.5 }],
      analysis: { noiLiftAnnual: 12000, expiringCount: 2, basis: "market rent vs in-place at rollover" },
    });
    expect(parsed.schedule?.[0].sizeSqft).toBe(2400);
    expect(parsed.analysis?.noiLiftAnnual).toBe(12000);
  });
  it("still parses with analysis absent", () => {
    const parsed = LeaseAnswer.parse({ answer: "x", citations: [], table: null });
    expect(parsed.analysis ?? null).toBeNull();
  });
});

describe("leaseIntelligencePrompt", () => {
  it("embeds the query and the context entries", () => {
    const { system, user } = leaseIntelligencePrompt({
      query: "HVAC?",
      context: [
        { leaseId: "lease_a", tenantName: "Acme", section: "7. Maintenance", page: 12, text: "Tenant HVAC ..." },
      ],
    });
    expect(system).toMatch(/Keystone Flex Partners/i);
    expect(user).toContain("Question: HVAC?");
    expect(user).toContain("lease_a");
    expect(user).toContain("Acme");
    expect(user).toContain("Tenant HVAC ...");
  });
});
