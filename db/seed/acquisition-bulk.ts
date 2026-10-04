// Loads the Foundry closing rent roll (1500 Foundry Avenue, Olmstead TX)
// from its committed pre-extracted JSON and turns it into a property row,
// occupied + vacant unit rows, lease abstract rows, and the per-section rows
// for the lease_sections_fts virtual table. No LLM call at seed time, the JSON
// is the source of truth.
//
// This is the persistence side of A5 (Acquisition Lease Bulk-Load). The same
// JSON also drives the six-table Yardi ETL preview via fanOutToYardiTables, but
// this loader only handles the app-state rows that C3 and L1 query: vacant
// units as available-to-rent shells (tenantName null) and occupied leases as
// leaseAbstracts + FTS sections (source bulk_load).
//
// If the JSON is absent the loader logs a warning and returns null, mirroring
// the parent-folder skip-with-warn pattern in oms.ts, so the seed still
// completes with the synthetic portfolio only.

import fs from "node:fs";
import path from "node:path";
import { id } from "@/lib/ids";
import { underwriteUnit, SEED_AS_OF } from "@/lib/uw";
import { FOUNDRY_UW } from "@/lib/uw-assumptions";
import { ClosingRentRoll, type RentRollLease } from "@/lib/etl/yardi-tables";

// The committed JSON wraps the ClosingRentRoll under data, with provenance
// metadata at the top level (matching the oms.ts extracted-JSON shape).
type ExtractedFoundryJson = {
  source: string;
  extractedAt: string;
  note?: string;
  data: unknown; // validated against ClosingRentRoll below
};

// Landlord on every inherited lease at closing (the seller of record).
const LANDLORD_NAME = "Prior Owner LLC";

type PropertyRow = {
  id: string;
  name: string;
  address: string;
  submarket: string;
  state: string;
  totalSqft: number | null;
  assetType: string;
  yearBuilt: number | null;
  geography: string;
  zipCode: string;
  county: string | null;
  hasOffice: boolean;
  clearHeightFt: number | null;
  marketRentYn: boolean;
  acquisitionDate: Date | null;
  source: "bulk_load";
  sourceDocId: null;
  ingestedAt: Date;
};

type UnitRow = {
  id: string;
  propertyId: string;
  suite: string;
  sizeSqft: number;
  leaseType: string;
  hasPrivateBathroom: boolean | null;
  currentRent: number | null;
  rentPerSqft: number | null;
  annualRent: number | null;
  leaseStart: Date | null;
  leaseEnd: Date | null;
  termYears: number | null;
  tenantName: string | null;
  tenantCategory: string | null;
  proportionateShareRsf: number | null;
  legacyRent: number | null;
  kfpRent: number | null;
  legacyTermYears: number | null;
  kfpTermYears: number | null;
  legacySf: number | null;
  kfpSf: number | null;
  rentUw: number | null;
  trendedRentAtLease: number | null;
  performanceToUw: number | null;
  leasedImpactUw: number | null;
  vacancyImpactUw: number | null;
  combinedImpactUw: number | null;
  annualRecoveryPsf: number | null;
  securityDeposit: number | null;
};

type AbstractRow = {
  id: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  suite: string;
  leaseStart: Date;
  leaseEnd: Date;
  baseRentSchedule: string;
  escalations: string;
  renewalOptions: string;
  tiAllowance: number | null;
  freeRentMonths: number;
  securityDeposit: number;
  camTerms: string;
  billingContact: string | null;
  estimatedRecoveryPsf: number | null;
  useClause: string;
  specialProvisions: string | null;
  extractionConfidence: string;
  extractionPath: "text" | "vision";
  rawSections: string;
  extractedAt: Date;
  source: "bulk_load";
  status: string;
};

type LeaseRow = {
  id: string;
  unitId: string;
  pdfPath: string;
  ingestedAt: Date;
};

export type AcquisitionBulkSeed = {
  property: PropertyRow;
  units: UnitRow[];
  leases: LeaseRow[];
  abstracts: AbstractRow[];
};

// Build the rawSections array for one inherited lease. C3 retrieval reads these
// JSON sections (also written to lease_sections_fts), so they must include the
// headings the C3 example prompts key on: Maintenance and HVAC Responsibility
// (q1), Security Deposit, Rent Schedule, Lease Dates, Parties, and Lender
// Consent and Loan Documents (q5).
function buildRawSections(
  lease: RentRollLease,
  address: string,
  monthlyRent: number,
  annualRentPerSqft: number,
  sqft: number,
): Array<{ section: string; page: number; text: string }> {
  const tenant = lease.leaseName;
  const sections: Array<{ section: string; page: number; text: string }> = [
    {
      section: "Parties",
      page: 1,
      text: `This Lease is between ${LANDLORD_NAME}, as Landlord, and ${tenant}, as Tenant, for premises at ${address}, Suite ${lease.suite ?? lease.units[0].unitCode}. This lease was inherited by Keystone at the acquisition of the property and bulk-loaded into the system of record.`,
    },
    {
      section: "Lease Dates",
      page: 1,
      text: `Lease commencement date ${lease.startDate}. Lease expiration date ${lease.endDate}. The term is approximately five years. Modified gross lease.`,
    },
    {
      section: "Rent Schedule",
      page: 2,
      text: `Base rent is ${monthlyRent} dollars per month, approximately ${annualRentPerSqft} dollars per square foot annually on ${sqft} square feet, modified gross. Tenant also pays an estimated utility charge billed monthly. Annual escalations of three percent apply on each anniversary of the commencement date.`,
    },
    {
      section: "Security Deposit",
      page: 2,
      text: `Tenant has posted a security deposit of ${lease.securityDeposit.toFixed(2)} dollars, held by Landlord and credited to the buyer at closing per the purchase and sale agreement.`,
    },
    {
      section: "Maintenance and HVAC Responsibility",
      page: 3,
      text: `Tenant is responsible for routine HVAC maintenance of the unit, including filter changes and periodic service. Landlord is responsible for structural repairs, the roof, and capital replacement of the HVAC system. For ${tenant}, HVAC service contracts are at Tenant's expense.`,
    },
    {
      section: "Lender Consent and Loan Documents",
      page: 4,
      text: `This Lease is subject to lender consent and to a subordination, non-disturbance and attornment agreement (SNDA) in favor of the acquisition lender. Loan documents and the SNDA for the ${tenant} lease were delivered to the financing team and the lender at closing. The Tenant's rights under this Lease are subordinate to the lien of the mortgage securing the acquisition loan, subject to the non-disturbance protections in the SNDA.`,
    },
  ];

  // Tenants with seller-owed leasing costs carry an extra Closing Credits
  // section so the note is queryable and citable.
  if (lease.unpaidLeasingCosts) {
    const u = lease.unpaidLeasingCosts;
    sections.push({
      section: "Closing Credits and Unpaid Leasing Costs",
      page: 4,
      text: `Unpaid leasing costs assumed by buyer at closing for the ${tenant} lease. ${u.note ?? ""}`.trim(),
    });
  }

  return sections;
}

export function buildAcquisitionBulkSeed(): AcquisitionBulkSeed | null {
  const jsonPath = path.resolve(
    process.cwd(),
    "db/seed/extracted/acquisition-bulk-foundry.json",
  );
  if (!fs.existsSync(jsonPath)) {
    console.warn(
      `[seed] ${jsonPath} not found; skipping the Foundry bulk-load seed. ` +
        `A5 vacant shells and bulk_load leases will be absent.`,
    );
    return null;
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as ExtractedFoundryJson;
  const rr = ClosingRentRoll.parse(parsed.data);

  const now = new Date();
  const prop = rr.property;
  const address = `${prop.address1}, ${prop.city}, ${prop.state} ${prop.zip}`;
  const closingDate = prop.closingDate ? new Date(prop.closingDate) : now;

  const propertyId = id("prop");
  const property: PropertyRow = {
    id: propertyId,
    name: prop.name ?? "Foundry Business Center",
    address,
    submarket: prop.submarket ?? prop.city,
    state: prop.state,
    totalSqft: prop.totalSf ?? null,
    assetType: "flex industrial",
    yearBuilt: null,
    geography: prop.submarket ?? prop.city,
    zipCode: prop.zip,
    county: prop.county ?? null,
    hasOffice: true,
    // Clear height is a genuine data gap on inherited units (forward-fill).
    clearHeightFt: null,
    marketRentYn: true,
    acquisitionDate: closingDate,
    source: "bulk_load",
    sourceDocId: null,
    ingestedAt: now,
  };

  const units: UnitRow[] = [];
  const leases: LeaseRow[] = [];
  const abstracts: AbstractRow[] = [];

  // Occupied leases: one unit row per unit (carrying tenant + rent), one lease
  // row, one abstract row with the C3 rawSections.
  rr.leases.forEach((lease, leaseIndex) => {
    const rentCharge = lease.charges.find((c) => c.code === "Rent");
    const monthlyRent = rentCharge ? rentCharge.amount : 0;
    const annualRent = Math.round(monthlyRent * 12);
    const contractedArea = lease.units.reduce((s, u) => s + u.sqft, 0);
    // Inherited leases are modified gross. The EstUtil charge (if present in the
    // closing rent roll) becomes the second Yardi charge line; carry its annual
    // $/sqft onto the abstract so L2's Push-to-Yardi output can render it.
    const estUtilCharge = lease.charges.find((c) => c.code === "EstUtil");
    const estimatedRecoveryPsf =
      estUtilCharge && contractedArea > 0
        ? Number(((estUtilCharge.amount * 12) / contractedArea).toFixed(2))
        : null;
    const annualRentPerSqft =
      contractedArea > 0
        ? Number(((annualRent / contractedArea)).toFixed(2))
        : null;
    const leaseStart = new Date(lease.startDate);
    const leaseEnd = new Date(lease.endDate);
    const termYears = Number(
      ((leaseEnd.getTime() - leaseStart.getTime()) / (365 * 86_400_000)).toFixed(
        1,
      ),
    );

    // First unit anchors the abstract suite; all units link to the lease.
    let firstUnitId: string | null = null;
    for (const u of lease.units) {
      const unitId = id("unit");
      if (firstUnitId === null) firstUnitId = unitId;
      const perSqft =
        u.sqft > 0 ? Number((annualRentPerSqft ?? 0).toFixed(2)) : null;
      const unitAnnualRent =
        perSqft != null ? Number((perSqft * u.sqft).toFixed(2)) : null;
      // Underwrite the inherited in-place rent against the Olmstead market
      // rent. Foundry rents read below the $19.50 market rent, so performance
      // to UW is negative (mark-to-market upside on the inherited leases).
      const uw = underwriteUnit({
        inPlaceRentPsf: perSqft,
        marketRentPsf: FOUNDRY_UW.marketRentPsf,
        sizeSqft: u.sqft,
        leaseStart: leaseStart.toISOString(),
        rentGrowthPct: 0.05,
        asOf: SEED_AS_OF,
      });
      units.push({
        id: unitId,
        propertyId,
        suite: lease.suite ?? u.unitCode,
        sizeSqft: u.sqft,
        // Inherited leases are all modified gross; surface as MG.
        leaseType: "MG",
        hasPrivateBathroom: null,
        currentRent: Math.round(monthlyRent / lease.units.length),
        rentPerSqft: perSqft,
        annualRent: unitAnnualRent,
        leaseStart,
        leaseEnd,
        termYears,
        tenantName: lease.leaseName,
        tenantCategory: lease.tenantCategory ?? null,
        proportionateShareRsf: null,
        // Inherited at acquisition = legacy.
        legacyRent: unitAnnualRent,
        kfpRent: null,
        legacyTermYears: termYears,
        kfpTermYears: null,
        legacySf: u.sqft,
        kfpSf: null,
        ...uw,
        annualRecoveryPsf: null,
        securityDeposit: lease.securityDeposit,
      });
    }

    const leaseId = id("lease");
    const abstractId = id("abst");

    leases.push({
      id: leaseId,
      unitId: firstUnitId as string,
      pdfPath: `fixtures/leases/foundry_${String(leaseIndex + 1).padStart(
        2,
        "0",
      )}_${lease.leaseName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.pdf`,
      ingestedAt: now,
    });

    // Base rent schedule with 3% annual escalation across the term.
    const fullTermYears = Math.max(1, Math.round(termYears));
    const baseRentSchedule = Array.from({ length: fullTermYears }, (_, yr) => ({
      from: new Date(leaseStart.getTime() + yr * 365 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      to: new Date(leaseStart.getTime() + (yr + 1) * 365 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      monthlyRent: Math.round(monthlyRent * Math.pow(1.03, yr)),
      annualRentPerSqft: Number(
        ((annualRentPerSqft ?? 0) * Math.pow(1.03, yr)).toFixed(2),
      ),
    }));

    const sections = buildRawSections(
      lease,
      address,
      monthlyRent,
      annualRentPerSqft ?? 0,
      contractedArea,
    );

    abstracts.push({
      id: abstractId,
      leaseId,
      tenantName: lease.leaseName,
      landlordName: LANDLORD_NAME,
      propertyAddress: address,
      suite: lease.suite ?? lease.units[0].unitCode,
      leaseStart,
      leaseEnd,
      baseRentSchedule: JSON.stringify(baseRentSchedule),
      escalations: JSON.stringify({ type: "fixed", annualPct: 3.0 }),
      // Inherited leases carry no renewal options in this dataset.
      renewalOptions: JSON.stringify([]),
      tiAllowance: lease.unpaidLeasingCosts?.tiAllowance ?? null,
      freeRentMonths: 0,
      securityDeposit: lease.securityDeposit,
      camTerms: JSON.stringify({
        type: "MG",
        proRataShare: "varies",
        reconciliation: "annual",
      }),
      billingContact: JSON.stringify({
        firstName: lease.billingContact.firstName || null,
        lastName: lease.billingContact.lastName || null,
        company: lease.billingContact.company || null,
        phone: lease.billingContact.phone || null,
        email: lease.billingContact.email || null,
      }),
      estimatedRecoveryPsf,
      useClause: `Tenant occupies the premises for ${
        lease.tenantCategory ?? "flex industrial"
      } use under a modified gross lease inherited at acquisition.`,
      specialProvisions: lease.unpaidLeasingCosts
        ? JSON.stringify([
            `Unpaid leasing costs assumed by buyer at closing. ${
              lease.unpaidLeasingCosts.note ?? ""
            }`.trim(),
          ])
        : null,
      extractionConfidence: JSON.stringify({
        tenantName: "high",
        leaseStart: "high",
        leaseEnd: "high",
        baseRentSchedule: "medium",
        securityDeposit: "high",
      }),
      // Bulk-loaded from the closing rent roll, not a per-document extraction.
      extractionPath: "text",
      rawSections: JSON.stringify(sections),
      extractedAt: now,
      source: "bulk_load",
      status: "pushed_to_yardi",
    });
  });

  // Vacant units: available-to-rent shells. tenantName null and rentPerSqft
  // null so they read as available (units.tenantName IS NULL convention).
  for (const v of rr.vacantUnits) {
    units.push({
      id: id("unit"),
      propertyId,
      suite: v.unitCode,
      sizeSqft: v.sqft,
      leaseType: "MG",
      hasPrivateBathroom: null,
      currentRent: null,
      rentPerSqft: null,
      annualRent: null,
      leaseStart: null,
      leaseEnd: null,
      termYears: null,
      tenantName: null,
      tenantCategory: null,
      proportionateShareRsf: null,
      legacyRent: null,
      kfpRent: null,
      legacyTermYears: null,
      kfpTermYears: null,
      legacySf: null,
      kfpSf: null,
      rentUw: null,
      trendedRentAtLease: null,
      performanceToUw: null,
      leasedImpactUw: null,
      vacancyImpactUw: null,
      combinedImpactUw: null,
      annualRecoveryPsf: null,
      securityDeposit: null,
    });
  }

  // Assign proportionate share now that the leasable total is known.
  const totalLeasableSf = units.reduce((s, u) => s + (u.sizeSqft ?? 0), 0);
  if (totalLeasableSf > 0) {
    for (const u of units) {
      u.proportionateShareRsf = Number(
        (((u.sizeSqft ?? 0) / totalLeasableSf) * 100).toFixed(2),
      );
    }
  }

  return { property, units, leases, abstracts };
}
