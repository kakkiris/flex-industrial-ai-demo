import { describe, it, expect } from "vitest";
import { noiLiftFromExpirations } from "@/lib/uw";

describe("noiLiftFromExpirations", () => {
  it("sums positive market-over-in-place lift across expiring leases", () => {
    const lift = noiLiftFromExpirations(
      [
        { inPlaceRentPsf: 18, sizeSqft: 2000 }, // (21-18)*2000 = 6000
        { inPlaceRentPsf: 22, sizeSqft: 1000 }, // above market -> 0
        { inPlaceRentPsf: null, sizeSqft: 1500 }, // unknown -> skipped
      ],
      21,
    );
    expect(lift).toBe(6000);
  });
});
