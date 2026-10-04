import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

// Simulates the leasing team reviewer approving an extracted lease abstract
// and pushing it to Yardi. No real Yardi API is involved; the demo only flips
// status + stamps a timestamp so the L2 review queue visibly drains.
//
// Body: none. Looks up by leaseId in the URL.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;
    const now = new Date();

    const updated = await db
      .update(schema.leaseAbstracts)
      .set({ status: "pushed_to_yardi", pushedToYardiAt: now })
      .where(eq(schema.leaseAbstracts.leaseId, leaseId))
      .returning({ id: schema.leaseAbstracts.id });

    if (updated.length === 0) {
      return NextResponse.json(
        { data: null, error: "Lease not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: { leaseId, abstractId: updated[0].id, pushedToYardiAt: now.toISOString() },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
