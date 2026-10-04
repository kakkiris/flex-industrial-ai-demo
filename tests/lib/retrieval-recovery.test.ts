import { describe, it, expect } from "vitest";
import { mentionsRecovery } from "@/lib/retrieval";

describe("mentionsRecovery", () => {
  it("fires on operating-expense recovery questions", () => {
    expect(mentionsRecovery("what is the operating expense recovery for Acme?")).toBe(true);
    expect(mentionsRecovery("base year and pass-throughs for suite 5")).toBe(true);
    expect(mentionsRecovery("CAM reconciliation method")).toBe(true);
  });
  it("does not fire on unrelated questions", () => {
    expect(mentionsRecovery("when does the lease expire?")).toBe(false);
  });
});
