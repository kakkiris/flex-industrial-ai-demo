import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { isNotNull, sql } from "drizzle-orm";

// Returns the set of distinct submarkets currently in the DB (synthetic
// portfolio + any OM-ingested properties). FilterSidebar fetches this so the
// submarket checkbox list grows automatically when a user uploads a new OM
// from an unseen market.

export async function GET() {
  try {
    const rows = await db
      .selectDistinct({ submarket: schema.properties.submarket })
      .from(schema.properties)
      .where(isNotNull(schema.properties.submarket))
      .orderBy(sql`lower(${schema.properties.submarket})`);
    const submarkets = rows
      .map((r) => r.submarket)
      .filter((s): s is string => Boolean(s));
    return NextResponse.json({ data: submarkets, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
