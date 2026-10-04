import { describe, it, expect } from "vitest";
import { sensitivityMatrix, underwriteProperty } from "@/lib/uw";
import { FOUNDRY_UW } from "@/lib/uw-assumptions";

describe("sensitivityMatrix", () => {
  const totalSqft = 76000;
  const basePrice = Math.round(FOUNDRY_UW.acquisitionBasisPsf * totalSqft);

  it("center cell matches underwriteProperty yield-on-cost", () => {
    const m = sensitivityMatrix({
      basePurchasePrice: basePrice,
      baseStabilizedRentPsf: FOUNDRY_UW.marketRentPsf,
      totalSqft, a: FOUNDRY_UW,
    });
    const center = m.cells[1][1].yieldOnCostPct;
    const expected = underwriteProperty([], FOUNDRY_UW, totalSqft).yieldOnCostPct;
    expect(Math.abs(center - expected)).toBeLessThan(0.0005);
  });

  it("produces a 3x3 grid with cost-to-stabilize and target", () => {
    const m = sensitivityMatrix({
      basePurchasePrice: basePrice, baseStabilizedRentPsf: FOUNDRY_UW.marketRentPsf,
      totalSqft, a: FOUNDRY_UW,
    });
    expect(m.rows).toHaveLength(3);
    expect(m.cols).toHaveLength(3);
    expect(m.cells.length).toBe(3);
    expect(m.cells[0].length).toBe(3);
    expect(m.costToStabilize).toBe(Math.round(FOUNDRY_UW.capexToDemisePsf * totalSqft));
    expect(m.targetYoCPct).toBeGreaterThan(0);
  });

  it("yield falls as price rises and rises as rent rises", () => {
    const m = sensitivityMatrix({
      basePurchasePrice: basePrice, baseStabilizedRentPsf: FOUNDRY_UW.marketRentPsf,
      totalSqft, a: FOUNDRY_UW,
    });
    expect(m.cells[0][1].yieldOnCostPct).toBeGreaterThan(m.cells[2][1].yieldOnCostPct);
    expect(m.cells[1][2].yieldOnCostPct).toBeGreaterThan(m.cells[1][0].yieldOnCostPct);
  });
});
