import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// Editable surface for the leasing inbox manual-action UI. Anything not in
// this set is ignored, verdict / confidence / reasoning stay AI-owned, and
// the manual override lives in `manual_verdict` so the original AI verdict is
// preserved for telemetry.
const EDITABLE = new Set([
  "businessType",
  "businessName",
  "spaceSizeSqft",
  "location",
  "timeline",
  "leaseTermYears",
  "existingLocations",
  "motivation",
  "loadingNeeds",
  "callbackPreferred",
  "phone",
  "manualVerdict",
  "scheduledVisitAt",
]);

type Body = Record<string, unknown>;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ data: null, error: "id required" }, { status: 400 });
    }
    const body = (await req.json()) as Body;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!EDITABLE.has(key)) continue;
      if (key === "scheduledVisitAt") {
        updates[key] = value === null || value === "" ? null : new Date(String(value));
      } else if (key === "manualVerdict") {
        if (value === null || value === "approved" || value === "rejected") {
          updates[key] = value;
        }
      } else if (key === "spaceSizeSqft" || key === "leaseTermYears") {
        updates[key] = value === null || value === "" ? null : Number(value);
      } else if (key === "callbackPreferred") {
        updates[key] = Boolean(value);
      } else {
        updates[key] = value === "" ? null : value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: null, error: "no editable fields" }, { status: 400 });
    }

    updates.actionedAt = new Date();
    updates.actionedBy = "leasing staff";

    await db.update(schema.leads).set(updates).where(eq(schema.leads.id, id));

    const after = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);

    if (after.length === 0) {
      return NextResponse.json({ data: null, error: "lead not found" }, { status: 404 });
    }

    return NextResponse.json({ data: after[0], error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
