// Optional check for the sample source documents (PDF/XLSX/DOCX) that the
// demo's upload affordances can load at runtime from the parent folder.
//
// Behavior:
// - The public repo ships only the pre-extracted JSON under db/seed/extracted/,
//   so the source documents are OPTIONAL. Seeding never depends on them.
// - When the parent folder is unreachable, or any fixture is missing, this
//   script logs a warning listing what is absent and exits 0 so `pnpm db:seed`
//   continues. Runtime "Ingest OM" / "Upload Lease" demos then show a
//   "fixture missing" toast instead of loading the sample file.

import fs from "node:fs";
import path from "node:path";

type Fixture = {
  filename: string;
  purpose: string;
};

const OPTIONAL_FIXTURES: Fixture[] = [
  { filename: "Keystone Lease Sample.pdf", purpose: "L2 text-path demo upload" },
  { filename: "Legacy Lease Sample.pdf", purpose: "L2 vision-path demo upload" },
  { filename: "Uptown Realty Advisors OM.pdf", purpose: "A1 OM ingestion demo" },
  { filename: "Crestview OM.pdf", purpose: "A1 OM ingestion demo" },
  { filename: "Meridian OM.pdf", purpose: "A1 OM ingestion demo" },
  { filename: "Harbor Park One rent roll.xlsx", purpose: "A1 column structure reference + rent calibration anchor" },
  { filename: "KFP Cold Call Notes.docx", purpose: "A2 reference script derivation source" },
];

const FIXTURE_ROOT = path.resolve(process.cwd(), "..");

function parentReachable(): boolean {
  try {
    const stat = fs.statSync(FIXTURE_ROOT);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function fixtureExists(filename: string): boolean {
  return fs.existsSync(path.join(FIXTURE_ROOT, filename));
}

function main(): void {
  if (!parentReachable()) {
    console.warn(
      `[verify-fixtures] Fixture folder ${FIXTURE_ROOT} is not reachable; ` +
      `skipping. Seeding uses the committed pre-extracted JSON.`
    );
    return;
  }

  const missing = OPTIONAL_FIXTURES.filter((f) => !fixtureExists(f.filename));
  if (missing.length === 0) {
    console.log(`[verify-fixtures] All ${OPTIONAL_FIXTURES.length} optional sample fixtures present.`);
    return;
  }

  console.warn(
    `[verify-fixtures] ${missing.length} of ${OPTIONAL_FIXTURES.length} optional sample fixtures ` +
    `not found in ${FIXTURE_ROOT}. Continuing; seeding uses the committed pre-extracted JSON.`
  );
  for (const f of missing) {
    console.warn(`  - ${f.filename}  (${f.purpose})`);
  }
}

main();
