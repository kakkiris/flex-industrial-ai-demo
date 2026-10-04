import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  reconstructSystemSection,
  reconstructAvailableUnitSection,
} from "@/lib/retrieval";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; section: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id, section } = await params;
    const decodedSection = decodeURIComponent(section);

    // C3-2: an availability citation cites a UNIT, not a lease. The "Available
    // Unit (system)" section carries a units.id as its `leaseId`, which can
    // never match leaseAbstracts.leaseId. Resolve it from the units table and
    // return a small available-unit summary instead of 404ing.
    if (/Available Unit \(system\)/i.test(decodedSection)) {
      const unitRows = await db
        .select({
          suite: schema.units.suite,
          sizeSqft: schema.units.sizeSqft,
          leaseType: schema.units.leaseType,
          tenantName: schema.units.tenantName,
          propertyName: schema.properties.name,
          propertyAddress: schema.properties.address,
        })
        .from(schema.units)
        .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
        .where(eq(schema.units.id, id))
        .limit(1);
      if (unitRows.length === 0) {
        return NextResponse.json({ data: null, error: "Unit not found" }, { status: 404 });
      }
      return NextResponse.json({
        data: reconstructAvailableUnitSection(unitRows[0]),
        error: null,
      });
    }

    const rows = await db
      .select()
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.leaseId, id))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ data: null, error: "Abstract not found" }, { status: 404 });
    }
    const abstract = rows[0];

    // C3-2: a "(system)" section is synthesized at retrieval time from the
    // lease's structured columns (Lease Dates, Rent Schedule, Deposit &
    // Concessions, Renewal Options, Expiration Schedule), not stored in
    // rawSections. Reconstruct it from the same columns so the citation
    // resolves instead of 404ing.
    if (/\(system\)/i.test(decodedSection)) {
      const reconstructed = reconstructSystemSection(decodedSection, {
        leaseId: abstract.leaseId ?? id,
        tenantName: abstract.tenantName,
        suite: abstract.suite,
        propertyAddress: abstract.propertyAddress,
        leaseStart: abstract.leaseStart,
        leaseEnd: abstract.leaseEnd,
        baseRentSchedule: abstract.baseRentSchedule,
        securityDeposit: abstract.securityDeposit,
        tiAllowance: abstract.tiAllowance,
        freeRentMonths: abstract.freeRentMonths,
        renewalOptions: abstract.renewalOptions,
      });
      if (!reconstructed) {
        return NextResponse.json({ data: null, error: "Section not found" }, { status: 404 });
      }
      return NextResponse.json({ data: reconstructed, error: null });
    }

    const rawSections: Array<{ section: string; page: number; text: string }> = abstract.rawSections
      ? JSON.parse(abstract.rawSections)
      : [];
    const match = rawSections.find((s) => s.section === decodedSection);
    if (!match) {
      return NextResponse.json({ data: null, error: "Section not found" }, { status: 404 });
    }
    return NextResponse.json({ data: match, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
