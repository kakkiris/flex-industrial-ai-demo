import { describe, it, expect } from "vitest";
import { getUwAssumptions, FOUNDRY_UW } from "@/lib/uw-assumptions";

describe("getUwAssumptions", () => {
  it("returns the built-out MG market rent for a Marisol built-out unit", () => {
    const a = getUwAssumptions("Parkhurst", { isBuiltOut: true, isExpansion: false });
    expect(a.marketRentPsf).toBeGreaterThanOrEqual(27);
    expect(a.marketRentPsf).toBeLessThanOrEqual(30);
    expect(a.acquisitionBasisPsf).toBeGreaterThan(0);
    expect(a.rentGrowthPct).toBeCloseTo(0.05, 3);
  });
  it("returns the raw-warehouse market rent for a non-built-out unit", () => {
    const a = getUwAssumptions("Parkhurst", { isBuiltOut: false, isExpansion: false });
    expect(a.marketRentPsf).toBeLessThanOrEqual(20);
  });
  it("Foundry override carries the Olmstead deal inputs", () => {
    expect(FOUNDRY_UW.acquisitionBasisPsf).toBeCloseTo(224.0, 1);
    expect(FOUNDRY_UW.marketRentPsf).toBe(19.5);
    expect(FOUNDRY_UW.capexToDemisePsf).toBeCloseTo(53.8, 1);
    expect(FOUNDRY_UW.rentGrowthPct).toBeCloseTo(0.05, 3);
  });
  it("falls back gracefully for an unknown submarket", () => {
    const a = getUwAssumptions("Nowhere", { isBuiltOut: true, isExpansion: false, fallbackRentPsf: 16 });
    expect(a.marketRentPsf).toBe(16);
    expect(a.acquisitionBasisPsf).toBeGreaterThan(0);
  });
});
