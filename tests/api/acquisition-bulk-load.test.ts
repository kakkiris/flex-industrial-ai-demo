import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock notify before importing the routes so the DB write is suppressed.
vi.mock("@/lib/notify", () => ({ notify: vi.fn(async () => undefined) }));

import { POST } from "@/app/api/acquisition/bulk-load/route";
import { GET } from "@/app/api/acquisition/preview/route";
import { notify } from "@/lib/notify";

describe("POST /api/acquisition/bulk-load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { data, error: null } with the correct counts and six table arrays", async () => {
    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.error).toBeNull();

    const { data } = json;
    expect(data).toBeDefined();

    // Property code from the committed JSON.
    expect(data.propertyCode).toBe("FNDY-1500");

    // Lease + unit counts: 22 occupied leases, 4 vacant shells.
    expect(data.leaseCount).toBe(22);
    expect(data.occupiedUnits).toBe(22);
    expect(data.vacantShells).toBe(4);

    // totalSf is a positive number.
    expect(data.totalSf).toBeGreaterThan(0);

    // All six table arrays are present.
    const { tables } = data;
    expect(tables).toBeDefined();
    expect(Array.isArray(tables.commLeases)).toBe(true);
    expect(Array.isArray(tables.commUnitXrefs)).toBe(true);
    expect(Array.isArray(tables.commUnits)).toBe(true);
    expect(Array.isArray(tables.commSqfts)).toBe(true);
    expect(Array.isArray(tables.commChargeSchedules)).toBe(true);
    expect(Array.isArray(tables.commContacts)).toBe(true);

    // commLeases has one row per occupied lease.
    expect(tables.commLeases.length).toBe(22);

    // Fan-out invariant: a vacant unit appears in commUnits but NOT in
    // commUnitXrefs.  Verify by collecting the xref Unit_Codes.
    const xrefCodes = new Set<string>(
      tables.commUnitXrefs.map((x: { Unit_Code: string }) => x.Unit_Code),
    );
    // The four vacant shells must each be in commUnits.
    const vacantRows = tables.commUnits.filter(
      (u: { Unit_Code: string }) => !xrefCodes.has(u.Unit_Code),
    );
    expect(vacantRows.length).toBe(4);

    // And none of those vacant Unit_Codes appear in commUnitXrefs.
    for (const row of vacantRows) {
      expect(xrefCodes.has(row.Unit_Code)).toBe(false);
    }

    // Closing-credits summary: two tenants carry unpaidLeasingCosts per the
    // Foundry JSON (IronForm Fitness LLC: TI + commission; Northstar Three LLC:
    // landlord work). The aggregate must equal the sum of both lease totals.
    const { closingCredits } = data;
    expect(closingCredits).toBeDefined();
    expect(closingCredits.lines).toHaveLength(2);

    const ironForm = closingCredits.lines.find(
      (l: { tenant: string }) => l.tenant === "IronForm Fitness LLC",
    );
    expect(ironForm).toBeDefined();
    expect(ironForm.tiAllowance).toBeCloseTo(1780.0);
    expect(ironForm.leasingCommission).toBeCloseTo(14212.8);
    expect(ironForm.landlordWork).toBe(0);
    expect(ironForm.total).toBeCloseTo(15992.8);

    const northstar = closingCredits.lines.find(
      (l: { tenant: string }) => l.tenant === "Northstar Three LLC",
    );
    expect(northstar).toBeDefined();
    expect(northstar.tiAllowance).toBe(0);
    expect(northstar.leasingCommission).toBe(0);
    expect(northstar.landlordWork).toBeCloseTo(23940.0);
    expect(northstar.total).toBeCloseTo(23940.0);

    // Aggregate: 15,992.80 + 23,940.00 = 39,932.80
    expect(closingCredits.aggregateTotal).toBeCloseTo(39932.8);
  });

  it("calls notify once with kind bulk_load_complete", async () => {
    await POST();
    expect(notify).toHaveBeenCalledOnce();
    const [call] = (notify as ReturnType<typeof vi.fn>).mock.calls;
    expect(call[0].kind).toBe("bulk_load_complete");
  });
});

describe("GET /api/acquisition/preview", () => {
  it("returns counts matching the bulk-load route (no tables payload)", async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.error).toBeNull();

    const { data } = json;
    expect(data.propertyCode).toBe("FNDY-1500");
    expect(data.leaseCount).toBe(22);
    expect(data.occupiedUnits).toBe(22);
    expect(data.vacantShells).toBe(4);
    expect(data.totalSf).toBeGreaterThan(0);

    // Preview does not expose the full tables payload.
    expect(data.tables).toBeUndefined();

    // Preview does expose closingCredits with the two known tenants.
    expect(data.closingCredits).toBeDefined();
    expect(data.closingCredits.lines).toHaveLength(2);
    const tenants = data.closingCredits.lines.map(
      (l: { tenant: string }) => l.tenant,
    );
    expect(tenants).toContain("IronForm Fitness LLC");
    expect(tenants).toContain("Northstar Three LLC");
    expect(data.closingCredits.aggregateTotal).toBeCloseTo(39932.8);
  });
});
