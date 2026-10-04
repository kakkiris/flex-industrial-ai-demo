import { describe, it, expect } from "vitest";
import { LeaseAbstract, RentStep, extractLeasePrompt } from "@/lib/prompts/extract-lease";

const validAbstract = {
  tenantName: "Acme HVAC LLC",
  landlordName: "KFP Holdings IV LLC",
  propertyAddress: "Linwood Commerce Park, Ashby Beach, TX",
  suite: "104",
  leaseStart: "2026-08-01",
  leaseEnd: "2031-07-31",
  baseRentSchedule: [
    { from: "2026-08-01", to: "2027-07-31", monthlyRent: 2200, annualRentPerSqft: 13.2 },
    { from: "2027-08-01", to: "2028-07-31", monthlyRent: 2266, annualRentPerSqft: 13.6 },
  ],
  escalations: { type: "fixed_pct", details: "3% annual" },
  renewalOptions: [{ number: 1, termYears: 5, noticeRequired: "180 days" }],
  tiAllowancePerSqft: 10,
  freeRentMonths: 1,
  securityDeposit: 4400,
  cam: { type: "NNN", recoveryMethod: "pro-rata share", caps: null },
  billingContact: { firstName: "Jordan", lastName: "Pierce", company: "Acme HVAC LLC", phone: "(555) 555-0101", email: "ap@acmehvac.example.com" },
  estimatedRecoveryPsf: null,
  useClause: "HVAC fabrication and storage only",
  specialProvisions: ["Right of first refusal on adjacent Suite 105"],
  rawSections: [
    { section: "1. Use Clause", page: 3, text: "Tenant shall use ..." },
    { section: "4. Base Rent", page: 5, text: "Annual base rent is ..." },
  ],
  confidence: {
    tenantName: { level: "high" },
    baseRentSchedule: { level: "medium", reason: "rent table partially OCR'd" },
  },
};

describe("LeaseAbstract schema", () => {
  it("accepts a fully populated valid abstract", () => {
    const parsed = LeaseAbstract.parse(validAbstract);
    expect(parsed.tenantName).toBe("Acme HVAC LLC");
    expect(parsed.baseRentSchedule).toHaveLength(2);
  });

  it("accepts null for optional financial fields", () => {
    const parsed = LeaseAbstract.parse({
      ...validAbstract,
      tiAllowancePerSqft: null,
      freeRentMonths: null,
      securityDeposit: null,
      useClause: null,
    });
    expect(parsed.tiAllowancePerSqft).toBeNull();
  });

  it("accepts a null billingContact (lease without a clear contact)", () => {
    const parsed = LeaseAbstract.parse({ ...validAbstract, billingContact: null });
    expect(parsed.billingContact).toBeNull();
  });

  it("accepts a billingContact with nullable person fields (entity-only lease)", () => {
    const parsed = LeaseAbstract.parse({
      ...validAbstract,
      billingContact: { firstName: null, lastName: null, company: "Acme HVAC LLC", phone: null, email: null },
    });
    expect(parsed.billingContact?.company).toBe("Acme HVAC LLC");
    expect(parsed.billingContact?.firstName).toBeNull();
  });

  it("carries the estimatedRecoveryPsf for MG leases and null otherwise", () => {
    const mg = LeaseAbstract.parse({ ...validAbstract, estimatedRecoveryPsf: 3.85 });
    expect(mg.estimatedRecoveryPsf).toBe(3.85);
    const nnn = LeaseAbstract.parse({ ...validAbstract, estimatedRecoveryPsf: null });
    expect(nnn.estimatedRecoveryPsf).toBeNull();
  });

  it("rejects a missing required field (tenantName)", () => {
    const { tenantName: _omit, ...rest } = validAbstract;
    void _omit;
    expect(() => LeaseAbstract.parse(rest)).toThrow();
  });

  it("rejects an invalid escalation type", () => {
    expect(() =>
      LeaseAbstract.parse({
        ...validAbstract,
        escalations: { type: "bogus", details: null },
      })
    ).toThrow();
  });

  it("rejects an invalid cam type", () => {
    expect(() =>
      LeaseAbstract.parse({
        ...validAbstract,
        cam: { type: "Net", recoveryMethod: null, caps: null },
      })
    ).toThrow();
  });

  it("rejects a non-integer freeRentMonths", () => {
    expect(() =>
      LeaseAbstract.parse({ ...validAbstract, freeRentMonths: 1.5 })
    ).toThrow();
  });
});

describe("RentStep schema", () => {
  it("requires monthlyRent and annualRentPerSqft as numbers", () => {
    expect(() =>
      RentStep.parse({
        from: "2026-08-01",
        to: "2027-07-31",
        monthlyRent: "two thousand",
        annualRentPerSqft: 13,
      })
    ).toThrow();
  });
});

const recoveryBase = {
  tenantName: "Acme Fab LLC", landlordName: "KFP", propertyAddress: "1 Industrial Blvd",
  suite: "101", leaseStart: "2024-01-01", leaseEnd: "2029-01-01",
  baseRentSchedule: [{ from: "2024-01-01", to: "2025-01-01", monthlyRent: 3000, annualRentPerSqft: 18 }],
  escalations: { type: "fixed_pct", details: "3%" }, renewalOptions: [],
  tiAllowancePerSqft: null, freeRentMonths: null, securityDeposit: 6000,
  cam: { type: "NNN", recoveryMethod: null, caps: null }, billingContact: null,
  estimatedRecoveryPsf: null, useClause: null, specialProvisions: [], rawSections: [],
  confidence: {},
};

describe("LeaseAbstract operatingExpenseRecovery", () => {
  it("parses a base-year-stop recovery block", () => {
    const parsed = LeaseAbstract.parse({
      ...recoveryBase,
      operatingExpenseRecovery: {
        recoveryType: "base_year_stop", baseYear: 2024, recoveryMethod: "pro_rata_share",
        proRataSharePct: 4.2, expenseCategories: ["taxes", "insurance", "cam"],
        capPct: 5, reconciliationBasis: "calendar_year", notes: "Tenant pays pro-rata over base year.",
      },
    });
    expect(parsed.operatingExpenseRecovery?.recoveryType).toBe("base_year_stop");
  });
  it("parses with the recovery field absent (back-compat)", () => {
    const parsed = LeaseAbstract.parse(recoveryBase);
    expect(parsed.operatingExpenseRecovery ?? null).toBeNull();
  });
});

describe("extractLeasePrompt", () => {
  it("returns system and user strings", () => {
    const { system, user } = extractLeasePrompt();
    expect(system).toMatch(/extracting key terms/i);
    expect(user).toMatch(/Extract the lease abstract/i);
    expect(user).toContain('"tenantName"');
  });

  it("instructs the model to capture the billing/notice contact", () => {
    const { system, user } = extractLeasePrompt();
    expect(system).toMatch(/billing\/notice contact/i);
    expect(system).toMatch(/Notices section/i);
    expect(user).toContain('"billingContact"');
    expect(user).toContain('"estimatedRecoveryPsf"');
  });

  it("appends the known-address hint when provided", () => {
    const { user } = extractLeasePrompt({ knownAddress: "Linwood Commerce Park" });
    expect(user).toContain("Linwood Commerce Park");
  });

  it("omits the hint when no address is given", () => {
    const { user } = extractLeasePrompt({});
    expect(user).not.toContain("known to refer to the property");
  });
});
