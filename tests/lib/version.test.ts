import { describe, it, expect } from "vitest";
import { parseVersion } from "@/lib/version";

describe("parseVersion", () => {
  it("returns 'proposal' only for the exact 'proposal' value", () => {
    expect(parseVersion("proposal")).toBe("proposal");
  });
  it("defaults to 'reframed' for null/undefined/empty/unknown", () => {
    expect(parseVersion(null)).toBe("reframed");
    expect(parseVersion(undefined)).toBe("reframed");
    expect(parseVersion("")).toBe("reframed");
    expect(parseVersion("chat")).toBe("reframed");
  });
});
