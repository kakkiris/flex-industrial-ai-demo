import { NextResponse } from "next/server";
import { loadAcquisitionPreview } from "@/lib/etl/acquisition-preview";

export const runtime = "nodejs";

export async function GET() {
  try {
    const preview = loadAcquisitionPreview();

    return NextResponse.json({
      data: {
        propertyCode: preview.propertyCode,
        leaseCount: preview.leaseCount,
        occupiedUnits: preview.occupiedUnits,
        vacantShells: preview.vacantShells,
        totalSf: preview.totalSf,
        closingCredits: preview.closingCredits,
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[acquisition/preview] error:", message);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
