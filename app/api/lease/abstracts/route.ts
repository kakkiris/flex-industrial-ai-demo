import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        leaseId: schema.leases.id,
        abstractId: schema.leaseAbstracts.id,
        tenantName: schema.leaseAbstracts.tenantName,
        suite: schema.leaseAbstracts.suite,
        leaseEnd: schema.leaseAbstracts.leaseEnd,
        pdfPath: schema.leases.pdfPath,
        extractionPath: schema.leaseAbstracts.extractionPath,
        extractedAt: schema.leaseAbstracts.extractedAt,
        source: schema.leaseAbstracts.source,
        status: schema.leaseAbstracts.status,
        pushedToYardiAt: schema.leaseAbstracts.pushedToYardiAt,
      })
      .from(schema.leaseAbstracts)
      .innerJoin(schema.leases, eq(schema.leases.id, schema.leaseAbstracts.leaseId))
      .orderBy(desc(schema.leaseAbstracts.extractedAt));
    return NextResponse.json({ data: rows, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
