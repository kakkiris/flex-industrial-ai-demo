import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { underwriteProperty, sensitivityMatrix } from "@/lib/uw";
import { getUwAssumptions, FOUNDRY_UW } from "@/lib/uw-assumptions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const props = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, id))
      .limit(1);
    if (props.length === 0) {
      return NextResponse.json({ data: null, error: "Property not found" }, { status: 404 });
    }
    const property = props[0];

    const units = await db
      .select({
        id: schema.units.id,
        suite: schema.units.suite,
        sizeSqft: schema.units.sizeSqft,
        leaseType: schema.units.leaseType,
        hasPrivateBathroom: schema.units.hasPrivateBathroom,
        currentRent: schema.units.currentRent,
        rentPerSqft: schema.units.rentPerSqft,
        leaseStart: schema.units.leaseStart,
        leaseEnd: schema.units.leaseEnd,
        tenantName: schema.units.tenantName,
        tenantCategory: schema.units.tenantCategory,
        // UW comparison columns surfaced 2026-05-27 per A1 P2.8.
        rentUw: schema.units.rentUw,
        trendedRentAtLease: schema.units.trendedRentAtLease,
        performanceToUw: schema.units.performanceToUw,
        leasedImpactUw: schema.units.leasedImpactUw,
        vacancyImpactUw: schema.units.vacancyImpactUw,
        combinedImpactUw: schema.units.combinedImpactUw,
        legacyRent: schema.units.legacyRent,
        kfpRent: schema.units.kfpRent,
        ccLevel: schema.compConfidence.rentConfidence,
        ccSource: schema.compConfidence.sourceType,
        ccQuote: schema.compConfidence.rawQuote,
        ccPage: schema.compConfidence.extractedFromPage,
      })
      .from(schema.units)
      .leftJoin(schema.compConfidence, eq(schema.compConfidence.unitId, schema.units.id))
      .where(eq(schema.units.propertyId, id));

    // Resolve the source document linked to this property, if any.
    let sourceDoc: { id: string; filename: string | null; pdfPath: string | null } | null = null;
    if (property.sourceDocId) {
      const docs = await db
        .select({
          id: schema.sourceDocuments.id,
          filename: schema.sourceDocuments.filename,
          pdfPath: schema.sourceDocuments.pdfPath,
        })
        .from(schema.sourceDocuments)
        .where(eq(schema.sourceDocuments.id, property.sourceDocId))
        .limit(1);
      if (docs.length > 0) sourceDoc = docs[0];
    }

    const isFoundry = property.name === "Foundry Business Center";
    const isBuiltOut = !!property.hasOffice && units.some((u) => u.hasPrivateBathroom === true);
    const firstUnit = units[0];
    const assumptions = isFoundry
      ? FOUNDRY_UW
      : getUwAssumptions(property.submarket ?? "", {
          isBuiltOut,
          isExpansion: false,
          fallbackRentPsf: firstUnit?.rentPerSqft ?? 18,
        });
    // Acquisition basis must reconcile with the rent it is underwritten against.
    // The rent is computed on the actual seeded unit inventory (leasable SF), so
    // the basis is taken on that same SF, not on property.totalSqft (the gross
    // building envelope, which is 1.5-3x the leasable SF on synthetic properties
    // and would understate the going-in cap by that factor). For Foundry the
    // units already sum to total_sqft, so the cap is unchanged.
    const totalSqft =
      units.reduce((s, u) => s + (u.sizeSqft ?? 0), 0) ||
      (property.totalSqft ?? 0);
    const underwriting = underwriteProperty(
      units.map((u) => ({ inPlaceRentPsf: u.rentPerSqft, sizeSqft: u.sizeSqft ?? 0 })),
      assumptions,
      totalSqft,
    );

    const sensitivity = sensitivityMatrix({
      basePurchasePrice: underwriting.acquisitionPrice,
      baseStabilizedRentPsf: assumptions.marketRentPsf,
      totalSqft,
      a: assumptions,
    });

    return NextResponse.json({ data: { property, units, sourceDoc, underwriting, sensitivity }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
