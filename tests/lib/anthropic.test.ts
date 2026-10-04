import { describe, it, expect } from "vitest";
import { pickModel, estimateCost } from "@/lib/anthropic";

describe("pickModel", () => {
  it("returns sonnet by default", () => {
    expect(pickModel("default")).toBe("claude-sonnet-4-6");
  });

  it("returns opus for high-stakes", () => {
    expect(pickModel("high-stakes")).toBe("claude-opus-4-7");
  });

  it("returns haiku for fast classification", () => {
    expect(pickModel("fast")).toBe("claude-haiku-4-5-20251001");
  });
});

describe("estimateCost", () => {
  it("returns 0 for unknown models", () => {
    expect(estimateCost("not-a-model", 1000, 1000)).toBe(0);
  });

  it("computes sonnet cost", () => {
    // 1M in + 1M out at sonnet rates = $3 + $15 = $18
    expect(estimateCost("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBeCloseTo(18, 5);
  });

  it("computes opus cost", () => {
    // 1M in + 1M out at opus rates = $15 + $75 = $90
    expect(estimateCost("claude-opus-4-7", 1_000_000, 1_000_000)).toBeCloseTo(90, 5);
  });
});
