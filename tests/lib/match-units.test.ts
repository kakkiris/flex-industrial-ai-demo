import { describe, it, expect } from "vitest";
import { matchUnits } from "@/lib/match-units";
import type { AvailableUnit } from "@/lib/prompts/leasing-chat";

// Vacant seeded units carry rentPerSqft = 0/null (no rent on an empty shell),
// so every fixture here keeps rent out of the ranking. matchUnits must rank on
// submarket + size band only.
const brightwaterSmall: AvailableUnit = {
  propertyName: "Brightwater Flex One",
  submarket: "Brightwater",
  suite: "101",
  sizeSqft: 1200,
  rentPerSqft: 0,
  leaseType: "MG",
};
const brightwaterLarge: AvailableUnit = {
  propertyName: "Brightwater Flex One",
  submarket: "Brightwater",
  suite: "210",
  sizeSqft: 5000,
  rentPerSqft: 0,
  leaseType: "MG",
};
const parkhurstMid: AvailableUnit = {
  propertyName: "Parkhurst Commerce",
  submarket: "Westbrook",
  suite: "5",
  sizeSqft: 2000,
  rentPerSqft: 0,
  leaseType: "NNN",
};
const orringtonMid: AvailableUnit = {
  propertyName: "Orrington Flex",
  submarket: "Orrington",
  suite: "12",
  sizeSqft: 2100,
  rentPerSqft: 0,
  leaseType: "MG",
};

const pool = [brightwaterSmall, brightwaterLarge, parkhurstMid, orringtonMid];

describe("matchUnits", () => {
  it("returns an empty array when there are no vacant units", () => {
    expect(matchUnits({ sqft: 2000, submarket: "Brightwater", leaseType: "MG" }, [])).toEqual([]);
  });

  it("prefers same-submarket units over other submarkets at equal size proximity", () => {
    // Asking for ~2000 sqft in Brightwater. The exact-size match lives in West
    // Parkhurst + Orrington, but the same-submarket Brightwater units must rank first.
    const ranked = matchUnits({ sqft: 2000, submarket: "Brightwater", leaseType: "MG" }, pool);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].submarket).toBe("Brightwater");
  });

  it("ranks the nearest size band first within the preferred submarket", () => {
    // Two Brightwater units (1200, 5000). Asking for 1500 should put the 1200 unit
    // ahead of the 5000 unit.
    const ranked = matchUnits({ sqft: 1500, submarket: "Brightwater", leaseType: "MG" }, pool);
    const brightwaterRanked = ranked.filter((u) => u.submarket === "Brightwater");
    expect(brightwaterRanked[0].sizeSqft).toBe(1200);
    expect(brightwaterRanked[1].sizeSqft).toBe(5000);
  });

  it("ranks the nearest size band first when no submarket is given", () => {
    const ranked = matchUnits({ sqft: 2050, submarket: null, leaseType: null }, pool);
    // Closest to 2050 is Westbrook 2000 (delta 50) or Orrington 2100 (delta 50);
    // both beat the Brightwater 1200 and 5000 units.
    expect([2000, 2100]).toContain(ranked[0].sizeSqft);
  });

  it("returns matches even when the submarket does not appear in the pool", () => {
    // A submarket with no inventory still degrades to size-band ranking rather
    // than returning [].
    const ranked = matchUnits({ sqft: 2000, submarket: "Altamont", leaseType: "NNN" }, pool);
    expect(ranked.length).toBe(pool.length);
    expect(ranked[0].sizeSqft).toBe(2000);
  });

  it("does not depend on rent (all fixtures have rentPerSqft 0)", () => {
    const ranked = matchUnits({ sqft: 1200, submarket: "Brightwater", leaseType: "MG" }, pool);
    expect(ranked[0]).toMatchObject({ submarket: "Brightwater", sizeSqft: 1200 });
  });

  it("respects a result cap", () => {
    const big = Array.from({ length: 20 }, (_, i) => ({ ...brightwaterSmall, suite: String(i), sizeSqft: 1000 + i * 100 }));
    const ranked = matchUnits({ sqft: 1500, submarket: "Brightwater", leaseType: "MG" }, big, 5);
    expect(ranked.length).toBe(5);
  });
});
