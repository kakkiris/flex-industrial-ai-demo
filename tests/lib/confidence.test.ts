import { describe, it, expect } from "vitest";
import {
  ConfidenceLevel,
  ConfidenceMap,
  SOURCE_RANK,
  badgeClass,
  lowestField,
} from "@/lib/confidence";

describe("ConfidenceLevel", () => {
  it("accepts the three valid levels", () => {
    expect(ConfidenceLevel.parse("high")).toBe("high");
    expect(ConfidenceLevel.parse("medium")).toBe("medium");
    expect(ConfidenceLevel.parse("low")).toBe("low");
  });

  it("rejects invalid values", () => {
    expect(() => ConfidenceLevel.parse("unknown")).toThrow();
  });
});

describe("ConfidenceMap", () => {
  it("parses a populated map", () => {
    const map = ConfidenceMap.parse({
      tenant: { level: "high" },
      rent: { level: "low", reason: "OM only" },
    });
    expect(map.tenant.level).toBe("high");
    expect(map.rent.reason).toBe("OM only");
  });

  it("rejects unknown level values", () => {
    expect(() =>
      ConfidenceMap.parse({ foo: { level: "great" } })
    ).toThrow();
  });
});

describe("SOURCE_RANK", () => {
  it("maps known source types", () => {
    expect(SOURCE_RANK.signed_lease).toBe("high");
    expect(SOURCE_RANK.om_rent_roll).toBe("medium");
    expect(SOURCE_RANK.costar_estimate).toBe("low");
  });
});

describe("badgeClass", () => {
  it("returns an emerald class for high", () => {
    expect(badgeClass("high")).toContain("emerald");
  });
  it("returns a rose class for low", () => {
    expect(badgeClass("low")).toContain("rose");
  });
  it("returns an amber class for medium", () => {
    expect(badgeClass("medium")).toContain("amber");
  });
});

describe("lowestField", () => {
  it("returns low when any field is low", () => {
    const map = ConfidenceMap.parse({
      a: { level: "high" },
      b: { level: "low" },
      c: { level: "medium" },
    });
    expect(lowestField(map)).toBe("low");
  });

  it("returns medium when no low and at least one medium", () => {
    const map = ConfidenceMap.parse({
      a: { level: "high" },
      b: { level: "medium" },
    });
    expect(lowestField(map)).toBe("medium");
  });

  it("returns high when all fields are high", () => {
    const map = ConfidenceMap.parse({
      a: { level: "high" },
      b: { level: "high" },
    });
    expect(lowestField(map)).toBe("high");
  });

  it("returns high for an empty map", () => {
    expect(lowestField({})).toBe("high");
  });
});
