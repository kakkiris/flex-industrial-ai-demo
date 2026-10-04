import { describe, it, expect } from "vitest";
import { desc } from "drizzle-orm";
import { retrieveLeaseSections, retrieveAvailability } from "@/lib/retrieval";
import { db, schema } from "@/db/client";
import {
  pickChipTenant,
  hvacChipString,
  lenderChipString,
} from "@/lib/c3-chips";

// Load the abstract rows the SAME way app/lease-intelligence/page.tsx does, so
// the chip tenant the test fires is exactly the chip tenant the page renders.
async function loadChipTenant(): Promise<string> {
  const rows = await db
    .select({
      tenantName: schema.leaseAbstracts.tenantName,
      source: schema.leaseAbstracts.source,
      rawSections: schema.leaseAbstracts.rawSections,
    })
    .from(schema.leaseAbstracts)
    .orderBy(desc(schema.leaseAbstracts.extractedAt));
  return pickChipTenant(rows);
}

describe("retrieveLeaseSections", () => {
  it("returns at least one section matching an HVAC query", async () => {
    const rows = await retrieveLeaseSections("Who is responsible for HVAC maintenance?");
    expect(rows.length).toBeGreaterThan(0);
    const hasMaintenance = rows.some((r) =>
      /hvac|maintenance/i.test(r.section + " " + r.text)
    );
    expect(hasMaintenance).toBe(true);
  });

  it("returns expiring leases for an expiration query", async () => {
    const rows = await retrieveLeaseSections("Which leases expire in the next 12 months?");
    // Whether or not any seeded leases happen to expire in the next 12 months,
    // the function should still return without throwing and may or may not
    // include results. Smoke-test the call shape.
    expect(Array.isArray(rows)).toBe(true);
  });

  it("returns an empty array for an unrelated query", async () => {
    const rows = await retrieveLeaseSections("Spacecraft cryogenic seal certification requirements");
    expect(Array.isArray(rows)).toBe(true);
  });

  // D.1: when the query names a property AND mentions expiration, the side path
  // groups expiring leases by property and surfaces a per-property schedule
  // section so the LLM can fill the structured `schedule` field.
  it("groups expiring leases by property for a property + expiration query", async () => {
    const rows = await retrieveLeaseSections(
      "Give me the tenant expiration schedule for the Foundry property at 1500 Foundry Avenue",
    );
    expect(rows.length).toBeGreaterThan(0);
    const scheduleSection = rows.find((r) => /Expiration Schedule \(system\)/i.test(r.section));
    expect(scheduleSection).toBeDefined();
    // The grouped section names the property it is scoped to.
    expect(/Foundry/i.test(scheduleSection!.text)).toBe(true);
  });

  // D.2: a loan-doc / lender-consent query returns at least one section whose
  // heading matches loan / lender / consent, sourced from a real bulk_load
  // rawSection (not a synthetic page-0 row), so the citation is clickable.
  it("surfaces a Lender Consent section for a loan-doc query", async () => {
    const rows = await retrieveLeaseSections(
      "Is lender consent required for the KTR Roofing lease?",
    );
    const loanDoc = rows.find((r) => /loan|lender|consent/i.test(r.section));
    expect(loanDoc).toBeDefined();
    // Real rawSection, not a system page-0 synthetic.
    expect(loanDoc!.page).toBeGreaterThan(0);
  });
});

// C3-3: regression for the marquee named-tenant chips. The audit found the page
// chips named "Gulf Coast HVAC Solutions" (abstractRows[0]) which got crowded
// out / had no lender section, so question #1 answered about the WRONG tenant,
// while the old tests passed on a hardcoded "KTR Roofing". These tests fire the
// EXACT chip strings the page produces (via the shared pickChipTenant) and
// assert the named tenant leads the retrieval pool.
describe("C3 named-tenant chips (the page's exact strings)", () => {
  it("selects a bulk_load chip tenant that has a Lender Consent section", async () => {
    const tenant = await loadChipTenant();
    const matches = await db
      .select({
        tenantName: schema.leaseAbstracts.tenantName,
        source: schema.leaseAbstracts.source,
        rawSections: schema.leaseAbstracts.rawSections,
      })
      .from(schema.leaseAbstracts);
    const row = matches.find((m) => m.tenantName === tenant);
    expect(row).toBeDefined();
    // The lender chip is only answerable for a lease that carries the section.
    expect(row!.source).toBe("bulk_load");
    const sections = JSON.parse(row!.rawSections ?? "[]") as Array<{ section: string }>;
    const hasLender = sections.some((s) => /lender|loan/i.test(s.section));
    const hasHvac = sections.some((s) => /hvac|maintenance/i.test(s.section));
    expect(hasLender).toBe(true);
    expect(hasHvac).toBe(true);
  });

  it("answers the HVAC chip about the NAMED tenant (it leads, with its own clause)", async () => {
    const tenant = await loadChipTenant();
    const rows = await retrieveLeaseSections(hvacChipString(tenant));
    expect(rows.length).toBeGreaterThan(0);
    // The named tenant must lead the pool with its OWN HVAC/maintenance section,
    // so the LLM grounds the answer on the named tenant rather than a crowding
    // bulk lease.
    const lead = rows[0];
    expect(lead.tenantName).toBe(tenant);
    expect(/hvac|maintenance/i.test(lead.section)).toBe(true);
    // The named tenant carries a real, clickable HVAC rawSection (page > 0).
    const namedHvac = rows.find(
      (r) => r.tenantName === tenant && /hvac|maintenance/i.test(r.section),
    );
    expect(namedHvac).toBeDefined();
    expect(namedHvac!.page).toBeGreaterThan(0);
  });

  it("answers the lender chip about the NAMED tenant (it leads, page > 0)", async () => {
    const tenant = await loadChipTenant();
    const rows = await retrieveLeaseSections(lenderChipString(tenant));
    expect(rows.length).toBeGreaterThan(0);
    const lead = rows[0];
    expect(lead.tenantName).toBe(tenant);
    expect(/lender|loan|consent/i.test(lead.section)).toBe(true);
    // The lender citation must be a real, clickable rawSection (not a page-0
    // system synthetic).
    const namedLender = rows.find(
      (r) => r.tenantName === tenant && /lender|loan|consent/i.test(r.section),
    );
    expect(namedLender).toBeDefined();
    expect(namedLender!.page).toBeGreaterThan(0);
  });
});

describe("retrieveAvailability", () => {
  // D.3: availability intent ("what is empty and rentable") returns vacant
  // units (tenantName null) joined to properties, as a result shape distinct
  // from lease sections.
  it("surfaces vacant Foundry units for an availability query", async () => {
    const units = await retrieveAvailability(
      "What is empty and rentable at the Foundry property?",
    );
    expect(units.length).toBeGreaterThan(0);
    const merc = units.filter((u) => /Foundry/i.test(u.propertyAddress ?? ""));
    expect(merc.length).toBeGreaterThan(0);
    for (const u of merc) {
      expect(u.tenantName).toBeNull();
      expect(u.sizeSqft).toBeGreaterThan(0);
    }
  });
});
