import { NextResponse } from "next/server";
import { loadAcquisitionPreview } from "@/lib/etl/acquisition-preview";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST() {
  try {
    const preview = loadAcquisitionPreview();

    await notify({
      kind: "bulk_load_complete",
      title: "Acquisition bulk-load complete",
      body: `${preview.propertyCode}: ${preview.leaseCount} leases, ${preview.vacantShells} vacant shells emitted as Yardi ETL tables for review.`,
      link: "/acquisition-bulk-load",
    });

    return NextResponse.json({
      data: {
        propertyCode: preview.propertyCode,
        leaseCount: preview.leaseCount,
        occupiedUnits: preview.occupiedUnits,
        vacantShells: preview.vacantShells,
        totalSf: preview.totalSf,
        tables: preview.tables,
        closingCredits: preview.closingCredits,
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[acquisition/bulk-load] error:", message);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
