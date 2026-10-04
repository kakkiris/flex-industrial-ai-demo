import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { and, eq, gte, lte, inArray, isNotNull, isNull, or } from "drizzle-orm";

export const runtime = "nodejs";

// Default clear-height slider bounds (must match FilterSidebar constants).
// The filter is only applied when the user has narrowed from these defaults;
// null-clear-height properties (legacy portfolio, pending capture) always pass
// unless the user actively restricts the range.
const CLEAR_HEIGHT_DEFAULT_MIN = 10;
const CLEAR_HEIGHT_DEFAULT_MAX = 36;

type SearchInput = {
  submarkets?: string[];
  minSqft?: number;
  maxSqft?: number;
  assetType?: string | null;
  leaseType?: string | null;
  // Filters added 2026-05-27 per audit P2.8.
  hasBathroom?: "yes" | "no" | null;
  hasOffice?: "yes" | "no" | null;
  tenantCategories?: string[];
  clearHeightMin?: number | null;
  clearHeightMax?: number | null;
};

const CONF_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s.length % 2 === 1
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchInput;
    const conds = [isNotNull(schema.units.rentPerSqft)];
    if (body.submarkets && body.submarkets.length > 0) {
      conds.push(inArray(schema.properties.submarket, body.submarkets));
    }
    if (typeof body.minSqft === "number") conds.push(gte(schema.units.sizeSqft, body.minSqft));
    if (typeof body.maxSqft === "number") conds.push(lte(schema.units.sizeSqft, body.maxSqft));
    if (body.assetType) conds.push(eq(schema.properties.assetType, body.assetType));
    if (body.leaseType) conds.push(eq(schema.units.leaseType, body.leaseType));
    if (body.hasBathroom === "yes") conds.push(eq(schema.units.hasPrivateBathroom, true));
    if (body.hasBathroom === "no") conds.push(eq(schema.units.hasPrivateBathroom, false));
    if (body.hasOffice === "yes") conds.push(eq(schema.properties.hasOffice, true));
    if (body.hasOffice === "no") conds.push(eq(schema.properties.hasOffice, false));
    if (body.tenantCategories && body.tenantCategories.length > 0) {
      conds.push(inArray(schema.units.tenantCategory, body.tenantCategories));
    }

    // Clear-height filter: null-clear-height properties (legacy portfolio, pending
    // capture) always pass unless the user has actively narrowed the range from the
    // defaults. When narrowed, we apply (IS NULL OR gte/lte) so the user sees
    // "at least X ft" among properties that actually have that data, while legacy
    // properties remain visible rather than silently vanishing.
    const chMin = typeof body.clearHeightMin === "number" ? body.clearHeightMin : CLEAR_HEIGHT_DEFAULT_MIN;
    const chMax = typeof body.clearHeightMax === "number" ? body.clearHeightMax : CLEAR_HEIGHT_DEFAULT_MAX;
    if (chMin > CLEAR_HEIGHT_DEFAULT_MIN) {
      conds.push(
        or(
          isNull(schema.properties.clearHeightFt),
          gte(schema.properties.clearHeightFt, chMin),
        )!,
      );
    }
    if (chMax < CLEAR_HEIGHT_DEFAULT_MAX) {
      conds.push(
        or(
          isNull(schema.properties.clearHeightFt),
          lte(schema.properties.clearHeightFt, chMax),
        )!,
      );
    }

    const joined = await db
      .select({
        unitId: schema.units.id,
        propertyId: schema.properties.id,
        propertyName: schema.properties.name,
        submarket: schema.properties.submarket,
        state: schema.properties.state,
        suite: schema.units.suite,
        sizeSqft: schema.units.sizeSqft,
        rentPerSqft: schema.units.rentPerSqft,
        leaseType: schema.units.leaseType,
        tenantName: schema.units.tenantName,
        tenantCategory: schema.units.tenantCategory,
        clearHeightFt: schema.properties.clearHeightFt,
        hasPrivateBathroom: schema.units.hasPrivateBathroom,
        hasOffice: schema.properties.hasOffice,
        legacyRent: schema.units.legacyRent,
        kfpRent: schema.units.kfpRent,
        ccLevel: schema.compConfidence.rentConfidence,
        ccSource: schema.compConfidence.sourceType,
        ccQuote: schema.compConfidence.rawQuote,
        ccPage: schema.compConfidence.extractedFromPage,
      })
      .from(schema.units)
      .innerJoin(schema.properties, eq(schema.properties.id, schema.units.propertyId))
      .leftJoin(schema.compConfidence, eq(schema.compConfidence.unitId, schema.units.id))
      .where(and(...conds))
      .limit(200);

    // Default confidence for internal-source units (no OM-derived comp_confidence row):
    // map "internal" property source to "high" (these are signed leases).
    const enriched = joined.map((r) => {
      const level = r.ccLevel ?? "high";
      return {
        unitId: r.unitId,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        submarket: r.submarket,
        state: r.state,
        suite: r.suite,
        sizeSqft: r.sizeSqft,
        rentPerSqft: r.rentPerSqft,
        leaseType: r.leaseType,
        tenantName: r.tenantName,
        tenantCategory: r.tenantCategory,
        clearHeightFt: r.clearHeightFt,
        hasPrivateBathroom: r.hasPrivateBathroom,
        hasOffice: r.hasOffice,
        legacyRent: r.legacyRent,
        kfpRent: r.kfpRent,
        confidence: {
          level,
          sourceType: r.ccSource ?? "signed_lease",
          rawQuote: r.ccQuote,
          page: r.ccPage,
        },
      };
    });

    enriched.sort((a, b) => {
      const ca = CONF_ORDER[a.confidence.level] ?? 99;
      const cb = CONF_ORDER[b.confidence.level] ?? 99;
      if (ca !== cb) return ca - cb;
      const ra = a.rentPerSqft ?? -Infinity;
      const rb = b.rentPerSqft ?? -Infinity;
      return rb - ra;
    });
    const rows = enriched.slice(0, 50);

    const rents = rows
      .map((r) => r.rentPerSqft)
      .filter((v): v is number => typeof v === "number");
    const sortedRents = [...rents].sort((a, b) => a - b);
    const medianRent =
      sortedRents.length === 0
        ? null
        : sortedRents.length % 2 === 1
          ? sortedRents[(sortedRents.length - 1) / 2]
          : (sortedRents[sortedRents.length / 2 - 1]! + sortedRents[sortedRents.length / 2]!) / 2;

    // Bathroom premium delta: median rent/sqft for units with bathroom vs without,
    // within the current result set. Surfaces the one-click delta Jordan asked for
    // pre-discovery: "rent delta for units with vs without private bathrooms."
    const withBathRents = rows
      .filter((r) => r.hasPrivateBathroom === true && r.rentPerSqft != null)
      .map((r) => r.rentPerSqft as number);
    const noBathRents = rows
      .filter((r) => r.hasPrivateBathroom === false && r.rentPerSqft != null)
      .map((r) => r.rentPerSqft as number);
    const medianWithBath = median(withBathRents);
    const medianNoBath = median(noBathRents);
    const bathroomPremium =
      medianWithBath !== null && medianNoBath !== null
        ? Number((medianWithBath - medianNoBath).toFixed(2))
        : null;

    return NextResponse.json({
      data: {
        rows,
        aggregates: {
          count: rows.length,
          medianRentPerSqft: medianRent,
          minRent: rents.length === 0 ? null : Math.min(...rents),
          maxRent: rents.length === 0 ? null : Math.max(...rents),
          // Bathroom premium delta (A1-2): spread between median rent/sqft for
          // units with vs without private bathrooms, within the current filter scope.
          bathroomPremium,
          bathroomMedianWith: medianWithBath !== null ? Number(medianWithBath.toFixed(2)) : null,
          bathroomMedianWithout: medianNoBath !== null ? Number(medianNoBath.toFixed(2)) : null,
        },
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
