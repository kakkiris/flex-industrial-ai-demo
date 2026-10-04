import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/properties/[id]/units/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

describe("GET /api/properties/[id]/units - underwriting", () => {
  it("returns a populated underwriting object for Foundry", async () => {
    const prop = db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, "Foundry Business Center"))
      .get();
    expect(prop).toBeDefined();
    const res = await GET(new Request("http://t"), {
      params: Promise.resolve({ id: prop!.id }),
    });
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data).toBeDefined();
    expect(json.data.underwriting).toBeDefined();
    // goingInCapPct for Foundry: basis $224.00/sqft on 76,000 sqft,
    // in-place rents from 22 occupied leases totalling ~73,800 SF (97% occupancy).
    // The weighted in-place PSF is ~17.65, below the $19.50 market rent, so the
    // going-in cap is ~7.7% and mark-to-market upside is positive.
    expect(json.data.underwriting.goingInCapPct).toBeGreaterThan(0.07);
    expect(json.data.underwriting.goingInCapPct).toBeLessThan(0.085);
    expect(json.data.underwriting.markToMarketUpsidePct).toBeGreaterThan(0);
    expect(typeof json.data.underwriting.yieldOnCostPct).toBe("number");
  });

  it("computes credible in-place going-in caps for synthetic properties", async () => {
    // The acquisition basis is now taken on the leasable unit SF (the same SF the
    // rent is computed on), not the gross building envelope. Before this fix the
    // basis used property.totalSqft (1.5-3x the leasable SF on synthetic
    // properties), understating every internal cap by that factor into a broken
    // 0.6-2.8% band. We assert across the whole internal population so a single
    // RNG-driven property cannot mask a regression of the order-of-magnitude bug.
    const internal = db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.source, "internal"))
      .all();
    expect(internal.length).toBeGreaterThan(0);

    const caps: number[] = [];
    for (const prop of internal) {
      const res = await GET(new Request("http://t"), {
        params: Promise.resolve({ id: prop.id }),
      });
      const json = await res.json();
      expect(json.error).toBeNull();
      expect(json.data.underwriting).toBeDefined();
      expect(typeof json.data.underwriting.yieldOnCostPct).toBe("number");
      expect(typeof json.data.underwriting.basisPsf).toBe("number");
      const cap = json.data.underwriting.goingInCapPct;
      // Null only when every unit is vacant (no in-place income to capitalise).
      if (cap !== null) {
        expect(typeof cap).toBe("number");
        // Every cap is a credible in-place going-in cap. The low end reflects the
        // synthetic vacancy drag (some buildings are heavily vacant), but nothing
        // should land back in the sub-1% / above-12% non-credible territory.
        expect(cap).toBeGreaterThan(0.01);
        expect(cap).toBeLessThan(0.12);
        caps.push(cap);
      }
    }

    expect(caps.length).toBeGreaterThan(0);
    // The order-of-magnitude fix means the typical synthetic property now caps in
    // the realistic 3%-9% range; pre-fix the entire internal population maxed out
    // near 2.8%. Require a clear majority above 3% so the fix cannot silently revert.
    const aboveThreePct = caps.filter((c) => c > 0.03).length;
    expect(aboveThreePct).toBeGreaterThan(caps.length / 2);
  });
});
