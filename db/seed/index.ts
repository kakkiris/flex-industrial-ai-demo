import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import path from "node:path";
import { buildProperties } from "./properties";
import { buildUnits } from "./units";
import { buildLeaseAbstracts } from "./lease-abstracts";
import { buildOmSeed } from "./oms";
import { buildAcquisitionBulkSeed } from "./acquisition-bulk";
import { buildLeads } from "./leads";
import type { AvailableUnit } from "@/lib/prompts/leasing-chat";

const url = (process.env.DATABASE_URL ?? "file:./db/kfp-demo.db").replace(
  /^file:/,
  ""
);
const dbPath = path.resolve(process.cwd(), url);
const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = OFF"); // disable during wipe to skip FK ordering pain
const db = drizzle(sqlite, { schema });

// 1. Wipe child tables first (and FTS), then parents.
const tablesInOrder = [
  schema.chatSessions,
  schema.leads,
  schema.queryLog,
  schema.notifications,
  schema.leaseAbstracts,
  schema.leases,
  schema.compConfidence,
  schema.units,
  schema.sourceDocuments,
  schema.properties,
] as const;

for (const t of tablesInOrder) {
  db.delete(t).where(sql`1=1`).run();
}
sqlite.exec("DELETE FROM lease_sections_fts;");

sqlite.pragma("foreign_keys = ON");

// 2. Synthetic KFP-profile properties + units (the internal portfolio).
const properties = buildProperties();
db.insert(schema.properties).values(properties).run();

const units = buildUnits(properties);
db.insert(schema.units).values(units).run();

// 2b. Sample OMs (Crestview, Uptown, Meridian) loaded from pre-extracted JSON. Adds
// source_documents + om-sourced properties + units + compConfidence rows so
// the A1 dashboard shows broker-OM comps alongside the synthetic
// portfolio. If the JSON files are missing the loader logs a warning and
// returns []; the seed continues with synthetic data only.
const omSeed = buildOmSeed();
if (omSeed.length > 0) {
  db.insert(schema.sourceDocuments)
    .values(omSeed.map((r) => r.sourceDoc))
    .run();
  db.insert(schema.properties).values(omSeed.map((r) => r.property)).run();
  const allOmUnits = omSeed.flatMap((r) => r.units);
  if (allOmUnits.length > 0) db.insert(schema.units).values(allOmUnits).run();
  const allCompConfidence = omSeed.flatMap((r) => r.compConfidence);
  if (allCompConfidence.length > 0)
    db.insert(schema.compConfidence).values(allCompConfidence).run();
}

// 2c. Foundry acquisition bulk-load (A5). Persists the inherited closing
// rent roll as a property + occupied/vacant units + bulk_load lease abstracts
// so C3 can query the inherited corpus and the empty-and-rentable shells. The
// same JSON drives the six-table Yardi ETL preview elsewhere. Skip-with-warn
// when the committed JSON is absent.
const acqBulk = buildAcquisitionBulkSeed();
if (acqBulk) {
  db.insert(schema.properties).values(acqBulk.property).run();
  if (acqBulk.units.length > 0)
    db.insert(schema.units).values(acqBulk.units).run();
}

// 4. Lease abstracts + FTS index. The synthetic L2/C3 abstracts plus the
// Foundry bulk_load abstracts share the same insert + FTS write path.
const { leases, abstracts } = buildLeaseAbstracts(units);
const allLeases = [...leases, ...(acqBulk?.leases ?? [])];
const allAbstracts = [...abstracts, ...(acqBulk?.abstracts ?? [])];
db.insert(schema.leases).values(allLeases).run();
db.insert(schema.leaseAbstracts).values(allAbstracts).run();

const ftsStmt = sqlite.prepare(
  `INSERT INTO lease_sections_fts (lease_id, section, page, text) VALUES (?, ?, ?, ?)`
);
for (const a of allAbstracts) {
  const sections: Array<{ section: string; page: number; text: string }> =
    JSON.parse(a.rawSections ?? "[]");
  for (const s of sections) {
    ftsStmt.run(a.leaseId, s.section, s.page, s.text);
  }
}

// 5. Optional demo leads (form-backed). Computed from the real seeded vacant
// inventory so the L1 inbox shows verdict badges + matched units on first load.
// Leads are never seeded in production; this is demo convenience only.
const propertyById = new Map<string, { name: string | null; submarket: string | null }>();
for (const p of properties) propertyById.set(p.id, { name: p.name, submarket: p.submarket });
for (const r of omSeed) propertyById.set(r.property.id, { name: r.property.name, submarket: r.property.submarket });
if (acqBulk) propertyById.set(acqBulk.property.id, { name: acqBulk.property.name, submarket: acqBulk.property.submarket });

const allUnitsForMatch = [
  ...units,
  ...omSeed.flatMap((r) => r.units),
  ...(acqBulk?.units ?? []),
];
const vacantAvailable: AvailableUnit[] = allUnitsForMatch
  .filter((u) => u.tenantName == null)
  .map((u) => {
    const prop = propertyById.get(u.propertyId as string);
    return {
      propertyName: prop?.name ?? "",
      submarket: prop?.submarket ?? "",
      suite: u.suite ?? "",
      sizeSqft: u.sizeSqft ?? 0,
      rentPerSqft: typeof u.rentPerSqft === "number" ? u.rentPerSqft : 0,
      leaseType: u.leaseType ?? "",
    };
  })
  .filter((u) => u.propertyName && u.submarket && u.suite && u.sizeSqft && u.leaseType);

const demoLeads = buildLeads(vacantAvailable);
if (demoLeads.length > 0) db.insert(schema.leads).values(demoLeads).run();

const omPropertyCount = omSeed.length;
const omUnitCount = omSeed.reduce((acc, r) => acc + r.units.length, 0);
const acqPropertyCount = acqBulk ? 1 : 0;
const acqUnitCount = acqBulk ? acqBulk.units.length : 0;
const acqAbstractCount = acqBulk ? acqBulk.abstracts.length : 0;
console.log(
  `Seeded ${properties.length + omPropertyCount + acqPropertyCount} properties ` +
    `(${omPropertyCount} from OMs, ${acqPropertyCount} from Foundry bulk-load), ` +
    `${units.length + omUnitCount + acqUnitCount} units ` +
    `(${omUnitCount} from OMs, ${acqUnitCount} from Foundry bulk-load), ` +
    `${allAbstracts.length} lease abstracts, ` +
    `${demoLeads.length} demo form leads.`
);
if (acqBulk) {
  const occupied = acqBulk.units.filter((u) => u.tenantName !== null).length;
  const vacant = acqBulk.units.length - occupied;
  console.log(
    `Foundry bulk-load: ${acqAbstractCount} bulk_load leases, ` +
      `${occupied} occupied units, ${vacant} vacant shells.`
  );
}

sqlite.close();
