import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/search-comps/route";
import { db, schema } from "@/db/client";
import { eq, and, isNotNull } from "drizzle-orm";

describe("POST /api/search-comps", () => {
  it("returns rows filtered by submarket and unit size", async () => {
    const req = new Request("http://localhost/api/search-comps", {
      method: "POST",
      body: JSON.stringify({ submarkets: ["Kingsley"], minSqft: 1500, maxSqft: 2500 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(json.data.rows.length).toBeGreaterThan(0);
    for (const r of json.data.rows) {
      expect(r.submarket).toBe("Kingsley");
      if (r.sizeSqft !== null) {
        expect(r.sizeSqft).toBeGreaterThanOrEqual(1500);
        expect(r.sizeSqft).toBeLessThanOrEqual(2500);
      }
    }
    expect(json.data.aggregates.count).toBe(json.data.rows.length);
  });

  it("returns empty when no submarkets match", async () => {
    const req = new Request("http://localhost/api/search-comps", {
      method: "POST",
      body: JSON.stringify({ submarkets: ["Mars"], minSqft: 1000, maxSqft: 3000 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.rows).toHaveLength(0);
    expect(json.data.aggregates.count).toBe(0);
  });

  it("built-out Modified Gross units are calibrated to $27-30/sqft (Harbor Park One)", () => {
    // Query units that are MG AND built out (hasPrivateBathroom AND property.hasOffice).
    // Scope to Parkhurst, Westbrook, Calder, Brightwater, Ashby Beach
    // (the Marisol synthetic submarkets). This excludes Olmstead (Foundry
    // bulk-load, explicit rents) and expansion markets (Altamont/Kingsley/
    // Orrington, where built-out MG units draw from the expansion premium band).
    const coreSubmarkets = [
      "Parkhurst", "Westbrook", "Calder", "Brightwater", "Ashby Beach",
    ];
    const rows = db
      .select({
        rent: schema.units.rentPerSqft,
        leaseType: schema.units.leaseType,
        bath: schema.units.hasPrivateBathroom,
        submarket: schema.properties.submarket,
      })
      .from(schema.units)
      .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
      .where(
        and(
          eq(schema.units.leaseType, "MG"),
          eq(schema.properties.hasOffice, true),
          eq(schema.units.hasPrivateBathroom, true),
        ),
      )
      .all()
      .filter((r) => coreSubmarkets.includes(r.submarket ?? ""));

    const leased = rows.filter((r) => r.rent != null);
    expect(leased.length).toBeGreaterThan(0);
    for (const r of leased) {
      expect(r.rent!).toBeGreaterThanOrEqual(27);
      expect(r.rent!).toBeLessThanOrEqual(30.5); // small tolerance for RNG jitter
    }
  });

  it("Performance-to-UW varies (not a constant) across the portfolio", () => {
    const vals = db.select({ p: schema.units.performanceToUw }).from(schema.units)
      .where(isNotNull(schema.units.performanceToUw)).all().map((r) => r.p!);
    const distinct = new Set(vals.map((v) => Math.round(v * 100)));
    expect(distinct.size).toBeGreaterThan(5); // real spread
    expect(vals.some((v) => v < 0)).toBe(true);
    expect(vals.some((v) => v > 0)).toBe(true);
  });

  it("pending-capture fields stay null where data was never collected (tenantCategory on OM units, clearHeightFt on bulk-load properties)", () => {
    // Guard the genuine-gap behavior: the UI renders "pending capture" badges
    // for tenantCategory on units and clearHeightFt on properties where the
    // source data simply did not include those fields. This test locks that
    // behavior so no future seed change silently fills every row.

    // Some OM-sourced units have a tenant name but no tenantCategory because
    // the OM did not state a business category for those tenants.
    const omUnitsWithNullCategory = db
      .select({ tenantName: schema.units.tenantName, tenantCategory: schema.units.tenantCategory })
      .from(schema.units)
      .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
      .where(eq(schema.properties.source, "om"))
      .all()
      .filter((u) => u.tenantName != null && u.tenantCategory == null);

    // At least one OM unit must be missing its category (genuine data gap from OM).
    expect(omUnitsWithNullCategory.length).toBeGreaterThan(0);

    // At least one property across the seed has null clearHeightFt (internal
    // legacy properties and the bulk-load Foundry property do not carry this).
    const propertiesWithNullHeight = db
      .select({ clearHeightFt: schema.properties.clearHeightFt })
      .from(schema.properties)
      .all()
      .filter((p) => p.clearHeightFt == null);

    expect(propertiesWithNullHeight.length).toBeGreaterThan(0);
  });

  it("forward-fill-only invariant: internal legacy units have null tenantCategory; OM units carry forward-filled values; internal properties have null clearHeightFt", () => {
    // A1-1 regression test: the transparency story requires that legacy/internal
    // units carry null tenantCategory (so the pending-capture badge fires on them)
    // while OM-ingested units carry the extracted tenantCategory. Similarly,
    // internal-source properties have null clearHeightFt (not captured before OM
    // ingestion existed) while OM properties carry the extracted clear height.

    // ALL leased internal-source units must have null tenantCategory.
    const internalLeasedWithCategory = db
      .select({ tenantCategory: schema.units.tenantCategory, tenantName: schema.units.tenantName })
      .from(schema.units)
      .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
      .where(and(eq(schema.properties.source, "internal"), isNotNull(schema.units.tenantName)))
      .all()
      .filter((u) => u.tenantCategory !== null);

    // No internal leased unit should have a tenantCategory.
    expect(internalLeasedWithCategory.length).toBe(0);

    // At least some internal leased units must exist with null tenantCategory.
    const internalLeasedNullCategory = db
      .select({ id: schema.units.id })
      .from(schema.units)
      .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
      .where(and(eq(schema.properties.source, "internal"), isNotNull(schema.units.tenantName)))
      .all();
    expect(internalLeasedNullCategory.length).toBeGreaterThan(0);

    // At least some OM-ingested units carry a tenantCategory (forward-filled from extraction).
    const omUnitsWithCategory = db
      .select({ tenantCategory: schema.units.tenantCategory })
      .from(schema.units)
      .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
      .where(eq(schema.properties.source, "om"))
      .all()
      .filter((u) => u.tenantCategory !== null);
    expect(omUnitsWithCategory.length).toBeGreaterThan(0);

    // ALL internal-source properties must have null clearHeightFt.
    const internalPropsWithHeight = db
      .select({ clearHeightFt: schema.properties.clearHeightFt })
      .from(schema.properties)
      .where(eq(schema.properties.source, "internal"))
      .all()
      .filter((p) => p.clearHeightFt !== null);
    expect(internalPropsWithHeight.length).toBe(0);

    // At least some internal-source properties exist (confirming the above is meaningful).
    const internalProps = db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.source, "internal"))
      .all();
    expect(internalProps.length).toBeGreaterThan(0);

    // At least some OM-ingested properties carry a clearHeightFt.
    const omPropsWithHeight = db
      .select({ clearHeightFt: schema.properties.clearHeightFt })
      .from(schema.properties)
      .where(eq(schema.properties.source, "om"))
      .all()
      .filter((p) => p.clearHeightFt !== null);
    expect(omPropsWithHeight.length).toBeGreaterThan(0);
  });

  it("null-clear-height properties are not excluded by the default filter (legacy comps stay visible)", async () => {
    // A1-1c regression: after nulling clear heights on internal properties, the
    // default clearHeightMin:10 / clearHeightMax:36 slider must not exclude them.
    // The route treats null-clear-height as unfiltered unless the user actively
    // narrows the range. Verify the default call returns internal-source comps.
    const defaultReq = new Request("http://localhost/api/search-comps", {
      method: "POST",
      body: JSON.stringify({ clearHeightMin: 10, clearHeightMax: 36 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(defaultReq);
    const json = await res.json();
    expect(res.status).toBe(200);

    // Must include internal-source rows (null clear height passes by default).
    const internalRows = (json.data.rows as Array<{ clearHeightFt: number | null }>).filter(
      (r) => r.clearHeightFt === null,
    );
    expect(internalRows.length).toBeGreaterThan(0);
    expect(json.data.aggregates.count).toBeGreaterThan(0);
  });

  it("bathroom premium delta is computed and returned in aggregates", async () => {
    // A1-2: the search-comps response must include bathroomPremium, the spread
    // between median rent/sqft for units with vs without private bathrooms.
    const req = new Request("http://localhost/api/search-comps", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    const agg = json.data.aggregates as {
      bathroomPremium: number | null;
      bathroomMedianWith: number | null;
      bathroomMedianWithout: number | null;
    };
    // Both bathroom groups exist in the seed, so the delta should be defined.
    expect(agg.bathroomPremium).not.toBeNull();
    expect(typeof agg.bathroomPremium).toBe("number");
    expect(agg.bathroomMedianWith).not.toBeNull();
    expect(agg.bathroomMedianWithout).not.toBeNull();
    // With-bathroom units rent at a premium in the seed (built-out band).
    expect(agg.bathroomMedianWith!).toBeGreaterThan(agg.bathroomMedianWithout!);
  });
});
