// Shared load + fan-out + count logic for the A5 (Acquisition Lease
// Bulk-Load) routes. Both POST /api/acquisition/bulk-load and GET
// /api/acquisition/preview call this helper so the two routes cannot diverge.

import fs from "node:fs";
import path from "node:path";
import { ClosingRentRoll } from "@/lib/etl/yardi-tables";
import { fanOutToYardiTables } from "@/lib/etl/fan-out";
import type { YardiEtlTables } from "@/lib/etl/yardi-tables";

// Wrapper shape written by the pre-extraction script and the seed loader.
type ExtractedJson = {
  source: string;
  extractedAt: string;
  note?: string;
  data: unknown;
};

// One tenant row in the closing-credits summary. Fields are present only when
// the corresponding cost was owed by the seller; absent fields should be read
// as zero. "total" is always the sum of the present fields.
export type ClosingCreditLine = {
  tenant: string;
  tiAllowance: number;
  leasingCommission: number;
  landlordWork: number;
  total: number;
  note: string;
};

// Deal-level closing-credits note: the individual tenant lines and the
// aggregate buyer credit at closing. This is NOT a Yardi CommLeases column;
// it is a deal-level note surfaced in the A5 UI so a presenter sees the
// closing-credit modeling without switching to the PSA.
export type ClosingCredits = {
  lines: ClosingCreditLine[];
  aggregateTotal: number;
};

export type AcquisitionPreview = {
  propertyCode: string;
  leaseCount: number;
  occupiedUnits: number;
  vacantShells: number;
  totalSf: number;
  tables: YardiEtlTables;
  closingCredits: ClosingCredits;
};

// Reads the committed Foundry JSON, validates it, runs the fan-out
// transform, and computes the counts the A5 routes expose.
//
// Counts:
//   leaseCount    = commLeases.length (one row per occupied lease)
//   occupiedUnits = distinct Unit_Code values in commUnitXrefs
//   vacantShells  = commUnits whose Unit_Code is NOT referenced by any xref
//   totalSf       = sum of commSqfts DSQFT0 (includes both occupied + vacant)
export function loadAcquisitionPreview(): AcquisitionPreview {
  const jsonPath = path.resolve(
    process.cwd(),
    "db/seed/extracted/acquisition-bulk-foundry.json",
  );

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Foundry JSON not found at ${jsonPath}. Run pnpm db:reset to seed it.`,
    );
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const envelope = JSON.parse(raw) as ExtractedJson;
  const rr = ClosingRentRoll.parse(envelope.data);
  const tables = fanOutToYardiTables(rr);

  const leaseCount = tables.commLeases.length;

  const xrefUnitCodes = new Set(tables.commUnitXrefs.map((x) => x.Unit_Code));
  const occupiedUnits = xrefUnitCodes.size;

  const vacantShells = tables.commUnits.filter(
    (u) => !xrefUnitCodes.has(u.Unit_Code),
  ).length;

  const totalSf = tables.commSqfts.reduce((sum, r) => sum + r.DSQFT0, 0);

  // Closing-credits summary: leases that carry unpaidLeasingCosts become
  // buyer credits at closing per PSA Schedule 2. The fan-out ignores these;
  // the UI surfaces them as a deal-level note, not a Yardi column.
  const creditLines: ClosingCreditLine[] = rr.leases
    .filter((l) => l.unpaidLeasingCosts !== undefined)
    .map((l) => {
      const ulc = l.unpaidLeasingCosts!;
      const tiAllowance = ulc.tiAllowance ?? 0;
      const leasingCommission = ulc.leasingCommission ?? 0;
      const landlordWork = ulc.landlordWork ?? 0;
      const total = tiAllowance + leasingCommission + landlordWork;
      return {
        tenant: l.leaseName,
        tiAllowance,
        leasingCommission,
        landlordWork,
        total,
        note: ulc.note ?? "",
      };
    });

  const aggregateTotal = creditLines.reduce((sum, l) => sum + l.total, 0);

  return {
    propertyCode: rr.propertyCode,
    leaseCount,
    occupiedUnits,
    vacantShells,
    totalSf,
    tables,
    closingCredits: {
      lines: creditLines,
      aggregateTotal,
    },
  };
}
