import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { isNotNull, sql } from "drizzle-orm";

// Returns distinct tenant categories present in the DB. Used by FilterSidebar
// to populate the multi-select. Categories come from two sources: A1 OM
// extraction (set on OM-ingested units) and L1 chat captures (eventually).
// Synthetic portfolio units inherit categories from the seeded tenant types.

export async function GET() {
  try {
    const rows = await db
      .selectDistinct({ category: schema.units.tenantCategory })
      .from(schema.units)
      .where(isNotNull(schema.units.tenantCategory))
      .orderBy(sql`lower(${schema.units.tenantCategory})`);
    const categories = rows
      .map((r) => r.category)
      .filter((c): c is string => Boolean(c));
    return NextResponse.json({ data: categories, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
