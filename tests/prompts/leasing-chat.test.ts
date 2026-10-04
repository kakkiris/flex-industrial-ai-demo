import { describe, it, expect } from "vitest";
import type { AvailableUnit } from "@/lib/prompts/leasing-chat";

// The conversational leasingChatSystemPrompt was retired with the chat widget
// (29-May feedback). formatAvailability was also removed (it had no
// runtime caller after the chat widget was retired). Only the AvailableUnit
// type is retained; lib/match-units.ts imports it for the vacancy matcher.

describe("AvailableUnit type", () => {
  it("satisfies the shape used by match-units", () => {
    // Structural smoke-test: an object matching the type should be assignable.
    const unit: AvailableUnit = {
      propertyName: "Test Park",
      submarket: "Brightwater",
      suite: "101",
      sizeSqft: 2000,
      rentPerSqft: 13.5,
      leaseType: "NNN",
    };
    expect(unit.sizeSqft).toBe(2000);
    expect(unit.leaseType).toBe("NNN");
  });
});
