// Loads the three sample broker OMs (Crestview, Uptown, Meridian) from their
// pre-extracted JSON committed to db/seed/extracted/ and turns them into
// property + unit + compConfidence rows. No LLM call at seed time; the
// extractor was run once via `pnpm tsx scripts/pre-extract.ts` and the JSON
// is the source of truth here.

import fs from "node:fs";
import path from "node:path";
import { id } from "@/lib/ids";
import { synthesizeOmUw } from "@/lib/uw";
import { SUBMARKETS } from "@/db/seed/_data";

type ExtractedJson = {
  source: string;
  extractedAt: string;
  data: {
    property: {
      name: string;
      address: string | null;
      submarket: string | null;
      state: string | null;
      totalSqft: number | null;
      assetType: string | null;
      yearBuilt: number | null;
      zipCode: string | null;
      county: string | null;
      hasOffice: boolean | null;
      clearHeightFt: number | null;
    };
    units: Array<{
      suite: string | null;
      sizeSqft: number | null;
      tenantName: string | null;
      tenantCategory: string | null;
      leaseType: "NNN" | "MG" | "Gross" | null;
      currentRent: number | null;
      rentPerSqft: number | null;
      leaseStart: string | null;
      leaseEnd: string | null;
      hasPrivateBathroom: boolean | null;
      rawQuote: string | null;
      extractedFromPage: number | null;
    }>;
    confidence: Record<string, { level: "high" | "medium" | "low"; reason: string }>;
  };
};

// Map each extracted JSON to the source filename in the parent fixtures folder
// so citation links resolve via the existing file allowlist.
const SOURCES = [
  { key: "crestview", pdfPath: "../Crestview OM.pdf" },
  { key: "uptown", pdfPath: "../Uptown Realty Advisors OM.pdf" },
  { key: "meridian", pdfPath: "../Meridian OM.pdf" },
] as const;

type OmSeedRow = {
  sourceDoc: {
    id: string;
    type: "om";
    filename: string;
    pdfPath: string;
    ingestedAt: Date;
  };
  property: {
    id: string;
    name: string;
    address: string | null;
    submarket: string | null;
    state: string | null;
    totalSqft: number | null;
    assetType: string | null;
    yearBuilt: number | null;
    geography: string | null;
    zipCode: string | null;
    county: string | null;
    hasOffice: boolean | null;
    clearHeightFt: number | null;
    marketRentYn: boolean;
    acquisitionDate: null;
    source: "om";
    sourceDocId: string;
    ingestedAt: Date;
  };
  units: Array<{
    id: string;
    propertyId: string;
    suite: string | null;
    sizeSqft: number | null;
    leaseType: string | null;
    hasPrivateBathroom: boolean | null;
    currentRent: number | null;
    rentPerSqft: number | null;
    annualRent: number | null;
    leaseStart: Date | null;
    leaseEnd: Date | null;
    tenantName: string | null;
    tenantCategory: string | null;
    rentUw: number | null;
    trendedRentAtLease: number | null;
    performanceToUw: number | null;
    leasedImpactUw: number | null;
    vacancyImpactUw: number | null;
    combinedImpactUw: number | null;
  }>;
  compConfidence: Array<{
    id: string;
    unitId: string;
    rentConfidence: "high" | "medium" | "low";
    sourceType: "om_rent_roll";
    rawQuote: string | null;
    extractedFromPage: number | null;
  }>;
};

function parseDateOrNull(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Confidence on a comp comes from two signals: the LLM's confidence map
// (rent-specific keys) and the presence of a verbatim rawQuote with a page.
// We err toward "medium" if rent is captured with a quote but the LLM didn't
// emit a confidence entry. Vacant rows skip the confidence row entirely.
function pickRentConfidence(
  llmConfidence: ExtractedJson["data"]["confidence"],
  hasQuote: boolean,
): "high" | "medium" | "low" {
  const rentKey = Object.keys(llmConfidence).find((k) =>
    /rent/i.test(k),
  );
  if (rentKey) return llmConfidence[rentKey].level;
  return hasQuote ? "medium" : "low";
}

export function buildOmSeed(): OmSeedRow[] {
  const dir = path.resolve(process.cwd(), "db/seed/extracted");
  if (!fs.existsSync(dir)) {
    console.warn(
      `[seed] db/seed/extracted not found. Run \`pnpm tsx scripts/pre-extract.ts --oms\` to regenerate.`,
    );
    return [];
  }

  const rows: OmSeedRow[] = [];
  const now = new Date();

  for (const { key, pdfPath } of SOURCES) {
    const jsonPath = path.join(dir, `${key}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.warn(`[seed] missing ${jsonPath}; skipping.`);
      continue;
    }
    const raw = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw) as ExtractedJson;

    const sourceDocId = id("om");
    const propertyId = id("prop");

    const property: OmSeedRow["property"] = {
      id: propertyId,
      name: parsed.data.property.name,
      address: parsed.data.property.address,
      submarket: parsed.data.property.submarket,
      state: parsed.data.property.state,
      totalSqft: parsed.data.property.totalSqft,
      assetType: parsed.data.property.assetType,
      yearBuilt: parsed.data.property.yearBuilt,
      geography: parsed.data.property.submarket,
      zipCode: parsed.data.property.zipCode,
      county: parsed.data.property.county,
      hasOffice: parsed.data.property.hasOffice,
      clearHeightFt: parsed.data.property.clearHeightFt,
      marketRentYn: true,
      acquisitionDate: null,
      source: "om",
      sourceDocId,
      ingestedAt: now,
    };

    // Submarket context for the engine: built-out = property office + unit
    // bathroom (the same signal the synthetic seeder uses); isExpansion comes
    // from the seeded submarket row when the OM's submarket is one we know.
    const submarket = parsed.data.property.submarket;
    const submarketRow = SUBMARKETS.find((s) => s.name === submarket);
    const isExpansion = submarketRow?.isExpansion ?? false;
    const propertyHasOffice = parsed.data.property.hasOffice === true;

    const units = parsed.data.units.map((u) => {
      const unitId = id("unit");
      const annualRent =
        u.rentPerSqft != null && u.sizeSqft != null
          ? Math.round(u.rentPerSqft * u.sizeSqft)
          : null;
      const isBuiltOut = propertyHasOffice && u.hasPrivateBathroom === true;
      const uw = synthesizeOmUw({
        rentPerSqft: u.rentPerSqft,
        sizeSqft: u.sizeSqft,
        annualRent,
        leaseStart: parseDateOrNull(u.leaseStart),
        submarket,
        isBuiltOut,
        isExpansion,
      });
      return {
        id: unitId,
        propertyId,
        suite: u.suite,
        sizeSqft: u.sizeSqft,
        leaseType: u.leaseType,
        hasPrivateBathroom: u.hasPrivateBathroom,
        currentRent: u.currentRent,
        rentPerSqft: u.rentPerSqft,
        annualRent,
        leaseStart: parseDateOrNull(u.leaseStart),
        leaseEnd: parseDateOrNull(u.leaseEnd),
        tenantName: u.tenantName,
        tenantCategory: u.tenantCategory,
        ...uw,
      };
    });

    const compConfidence = units
      .map((unit, i) => {
        const om = parsed.data.units[i];
        // Skip vacant rows: there is no rent comp to confidence-score.
        if (om.rentPerSqft == null && om.currentRent == null) return null;
        return {
          id: id("cc"),
          unitId: unit.id,
          rentConfidence: pickRentConfidence(parsed.data.confidence, Boolean(om.rawQuote)),
          sourceType: "om_rent_roll" as const,
          rawQuote: om.rawQuote,
          extractedFromPage: om.extractedFromPage,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    rows.push({
      sourceDoc: {
        id: sourceDocId,
        type: "om",
        filename: parsed.source,
        pdfPath,
        ingestedAt: now,
      },
      property,
      units,
      compConfidence,
    });
  }

  return rows;
}
