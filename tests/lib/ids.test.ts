import { describe, it, expect } from "vitest";
import { id } from "@/lib/ids";

describe("id", () => {
  it("returns a string starting with the given prefix and underscore", () => {
    const result = id("ntf");
    expect(typeof result).toBe("string");
    expect(result.startsWith("ntf_")).toBe(true);
  });

  it("generates unique values on consecutive calls", () => {
    const a = id("ntf");
    const b = id("ntf");
    expect(a).not.toBe(b);
  });

  it("uses the provided prefix correctly for different prefixes", () => {
    expect(id("usr").startsWith("usr_")).toBe(true);
    expect(id("org").startsWith("org_")).toBe(true);
  });
});
