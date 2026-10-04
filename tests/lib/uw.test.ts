import { describe, it, expect } from "vitest";
import { underwriteUnit, underwriteProperty } from "@/lib/uw";
import { FOUNDRY_UW } from "@/lib/uw-assumptions";

describe("underwriteUnit", () => {
  const base = { marketRentPsf: 21, sizeSqft: 2000, leaseStart: "2023-01-01", rentGrowthPct: 0.05, asOf: "2026-01-01" };
  it("sets rentUw to market and performanceToUw negative when below market", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: 19.4 });
    expect(u.rentUw).toBe(21);
    expect(u.performanceToUw).toBeLessThan(0); // below market = upside
    expect(u.performanceToUw).toBeCloseTo((19.4 - 21) / 21, 4);
    expect(u.leasedImpactUw).toBeCloseTo((19.4 - 21) * 2000, 1);
  });
  it("performanceToUw positive when above market", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: 24 });
    expect(u.performanceToUw).toBeGreaterThan(0);
  });
  it("vacant unit: null performanceToUw, vacancyImpact carries un-captured market rent", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: null });
    expect(u.performanceToUw).toBeNull();
    expect(u.rentUw).toBe(21);
    expect(u.vacancyImpactUw).toBeCloseTo(-21 * 2000, 1);
  });
  it("trendedRentAtLease grows market from lease start", () => {
    const u = underwriteUnit({ ...base, inPlaceRentPsf: 19.4 });
    expect(u.trendedRentAtLease).toBeCloseTo(21 * Math.pow(1.05, 3), 2);
  });
});

describe("underwriteProperty", () => {
  // two units approximating Foundry: 73,845 leased sqft at ~$17.65, 2,155 vacant
  const units = [
    { inPlaceRentPsf: 17.65, sizeSqft: 73845 },
    { inPlaceRentPsf: null, sizeSqft: 2155 },
  ];
  it("reproduces the Foundry going-in cap (~7.7%) and shows mark-to-market upside", () => {
    const p = underwriteProperty(units, FOUNDRY_UW, 76000);
    expect(p.goingInCapPct).toBeGreaterThan(0.070);
    expect(p.goingInCapPct).toBeLessThan(0.085);
    expect(p.markToMarketUpsidePct).toBeGreaterThan(0); // in-place below market
    expect(p.acquisitionPrice).toBeCloseTo(224.0 * 76000, 0);
  });
  it("stabilized NOI exceeds in-place NOI (value-add upside)", () => {
    const p = underwriteProperty(units, FOUNDRY_UW, 76000);
    expect(p.stabilizedNOI).toBeGreaterThan(p.inPlaceNOI);
    expect(p.yieldOnCostPct).toBeGreaterThan(0);
  });
  it("guards divide-by-zero for a fully vacant property", () => {
    const p = underwriteProperty([{ inPlaceRentPsf: null, sizeSqft: 1000 }], FOUNDRY_UW, 1000);
    expect(p.goingInCapPct).toBeNull();
    expect(p.weightedInPlacePsf).toBeNull();
  });
});
