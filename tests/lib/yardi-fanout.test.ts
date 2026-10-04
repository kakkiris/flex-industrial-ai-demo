import { it, expect } from "vitest";
import { fanOutToYardiTables } from "@/lib/etl/fan-out";
import { ClosingRentRoll } from "@/lib/etl/yardi-tables";

const input = {
  propertyCode: "0900001",
  property: { address1: "1500 Foundry Avenue", city: "Olmstead", state: "TX", zip: "78475" },
  leases: [
    { leaseCode: "t1", leaseName: "Brightline Lighting Supply Inc", leaseType: "modgrs", startDate: "2023-01-01", endDate: "2027-12-31",
      securityDeposit: 2533.0, units: [{ unitCode: "A1", sqft: 1070 }], charges: [{ code: "Rent", amount: 2900 }, { code: "EstUtil", amount: 180 }],
      billingContact: { firstName: "", lastName: "Brightline Lighting Supply Inc", company: "Brightline Lighting Supply Inc", phone: "", email: "" } },
    { leaseCode: "t2", leaseName: "KTR Roofing LLC", leaseType: "modgrs", startDate: "2024-06-01", endDate: "2029-05-31",
      securityDeposit: 2486.16, units: [{ unitCode: "A2", sqft: 1235 }, { unitCode: "A3", sqft: 1235 }], charges: [{ code: "Rent", amount: 6500 }, { code: "EstUtil", amount: 360 }],
      billingContact: { firstName: "", lastName: "KTR Roofing LLC", company: "KTR Roofing LLC", phone: "", email: "" } },
  ],
  vacantUnits: [{ unitCode: "B1", sqft: 990 }],
};

it("fans an occupied lease across all six tables and a vacant unit into a 2-table shell", () => {
  const t = fanOutToYardiTables(input);
  expect(t.commLeases).toHaveLength(2);
  expect(t.commUnitXrefs).toHaveLength(3); // t1:1 + t2:2
  expect(t.commUnits).toHaveLength(4);     // 3 occupied + 1 vacant
  expect(t.commSqfts).toHaveLength(4);
  expect(t.commChargeSchedules).toHaveLength(4); // 2 charges x 2 leases
  expect(t.commContacts).toHaveLength(2);
  expect(t.commUnitXrefs.find((x) => x.Unit_Code === "B1")).toBeUndefined();
  expect(t.commUnits.find((u) => u.Unit_Code === "B1")).toBeDefined();
  for (const r of t.commLeases) { expect(r.Property_Code).toBe("0900001"); expect(r.Lease_Code).toBeTruthy(); }
  for (const r of t.commUnits) { expect(r.Property_Code).toBe("0900001"); expect(r.Unit_Code).toBeTruthy(); }
});

it("emits only CommUnits + CommSQFTs for a vacant-only input, with empty lease-scoped arrays", () => {
  const vacantOnly = {
    propertyCode: "0900001",
    property: { address1: "1500 Foundry Avenue", city: "Olmstead", state: "TX", zip: "78475" },
    leases: [],
    vacantUnits: [
      { unitCode: "B2", sqft: 905 },
      { unitCode: "B3", sqft: 1975 },
    ],
  };
  const t = fanOutToYardiTables(vacantOnly);
  expect(t.commLeases).toHaveLength(0);
  expect(t.commUnitXrefs).toHaveLength(0);
  expect(t.commChargeSchedules).toHaveLength(0);
  expect(t.commContacts).toHaveLength(0);
  expect(t.commUnits).toHaveLength(2);
  expect(t.commSqfts).toHaveLength(2);
  // Vacant shells carry no Lease_Type and no lease scoping.
  for (const u of t.commUnits) {
    expect(u.Property_Code).toBe("0900001");
    expect(u.Unit_Code).toBeTruthy();
    expect(u.Lease_Type).toBeNull();
  }
});

it("leaseType flows verbatim into CommLeases.Lease_Type and CommUnits.Lease_Type", () => {
  const nnnInput = {
    propertyCode: "0900001",
    property: { address1: "1500 Foundry Avenue", city: "Olmstead", state: "TX", zip: "78475" },
    leases: [
      { leaseCode: "t9", leaseName: "NNN Tenant LLC", leaseType: "nnn", startDate: "2025-01-01", endDate: "2028-12-31",
        securityDeposit: 1000, units: [{ unitCode: "901", sqft: 1000 }], charges: [{ code: "Rent", amount: 1500 }],
        billingContact: { firstName: "", lastName: "NNN Tenant LLC", company: "NNN Tenant LLC", phone: "", email: "" } },
    ],
    vacantUnits: [],
  };
  const t = fanOutToYardiTables(nnnInput);
  const lease = t.commLeases.find((l) => l.Lease_Code === "t9");
  expect(lease?.Lease_Type).toBe("nnn");
  const unit = t.commUnits.find((u) => u.Unit_Code === "901");
  expect(unit?.Lease_Type).toBe("nnn");
});

it("rejects a malformed input where a lease is missing its leaseCode", () => {
  const malformed = {
    propertyCode: "0900001",
    property: { address1: "1500 Foundry Avenue", city: "Olmstead", state: "TX", zip: "78475" },
    leases: [
      {
        // leaseCode intentionally omitted
        leaseName: "Broken Tenant LLC",
        leaseType: "modgrs",
        startDate: "2023-01-01",
        endDate: "2027-12-31",
        securityDeposit: 1000,
        units: [{ unitCode: "301", sqft: 1000 }],
        charges: [{ code: "Rent", amount: 2000 }],
        billingContact: { firstName: "", lastName: "Broken Tenant LLC", company: "Broken Tenant LLC", phone: "", email: "" },
      },
    ],
    vacantUnits: [],
  };
  expect(() => fanOutToYardiTables(malformed as unknown as ClosingRentRoll)).toThrow();
  // The schema itself must also reject it, so it is real validation, not decoration.
  expect(() => ClosingRentRoll.parse(malformed)).toThrow();
});
