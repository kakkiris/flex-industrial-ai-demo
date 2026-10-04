import { id } from "@/lib/ids";
import { PROPERTY_NAMES, SUBMARKETS, makeRng, pickRange, pickFrom } from "./_data";

// Builds 8 KFP-profile properties, one per submarket, with the full
// rent-roll-aligned filter set (geography, zip, county, has_office at the
// property level, clear_height_ft, market_rent_yn, acquisition_date).
export function buildProperties() {
  const rng = makeRng(101);
  const now = Date.now();
  return SUBMARKETS.map((sm, i) => {
    // Acquisition date: 6 months to 5 years ago
    const monthsAgo = pickRange(rng, 6, 60);
    const acquisitionDate = new Date(now - monthsAgo * 30 * 86_400_000);
    // ~70% of properties have an office bay. Clear height is NOT set on
    // internal-source (legacy) properties: the field was not captured before
    // the OM ingestion solution existed. The UI renders a "pending capture"
    // badge where clearHeightFt is null. Only OM-ingested properties (oms.ts)
    // carry a real clear height extracted from the OM document.
    const hasOffice = rng() > 0.3;
    const clearHeightFt = null;

    return {
      id: id("prop"),
      name: PROPERTY_NAMES[i],
      address: `${pickRange(rng, 100, 9000)} ${sm.name} Industrial Blvd`,
      submarket: sm.name,
      state: sm.state,
      totalSqft: pickRange(rng, 30_000, 100_000),
      assetType: "flex industrial",
      yearBuilt: pickRange(rng, 1985, 2020),
      geography: sm.name,
      zipCode: pickFrom(rng, sm.zipCodes),
      county: sm.county,
      hasOffice,
      clearHeightFt,
      marketRentYn: true,
      acquisitionDate,
      source: "internal",
      sourceDocId: null,
      ingestedAt: new Date(),
    };
  });
}
