import { NextResponse } from "next/server";
import path from "node:path";
import { db, schema } from "@/db/client";
import { extractWithVision, savePdfToUploads } from "@/lib/pdf";
import { extractOmPrompt, OMExtraction } from "@/lib/prompts/extract-om";
import { notify } from "@/lib/notify";
import { id } from "@/lib/ids";
import { synthesizeOmUw } from "@/lib/uw";
import { SUBMARKETS } from "@/db/seed/_data";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ data: null, error: "file field required" }, { status: 400 });
    }
    const relativePath = await savePdfToUploads(file, "oms");
    const absolutePath = path.resolve(process.cwd(), relativePath);

    const { system, user } = extractOmPrompt();
    const { data: parsed } = await extractWithVision({
      filePath: absolutePath,
      systemPrompt: system,
      userPrompt: user,
      tier: "default",
      parse: (json) => OMExtraction.parse(JSON.parse(json)),
    });

    const docId = id("doc");
    const propertyId = id("prop");

    db.transaction((tx) => {
      tx.insert(schema.sourceDocuments).values({
        id: docId,
        type: "om",
        filename: file.name,
        pdfPath: relativePath,
        ingestedAt: new Date(),
      }).run();

      tx.insert(schema.properties).values({
        id: propertyId,
        name: parsed.property.name,
        address: parsed.property.address,
        submarket: parsed.property.submarket,
        state: parsed.property.state,
        totalSqft: parsed.property.totalSqft,
        assetType: parsed.property.assetType,
        yearBuilt: parsed.property.yearBuilt,
        zipCode: parsed.property.zipCode,
        county: parsed.property.county,
        hasOffice: parsed.property.hasOffice,
        clearHeightFt: parsed.property.clearHeightFt,
        geography: parsed.property.submarket,
        source: "om",
        sourceDocId: docId,
        ingestedAt: new Date(),
      }).run();

      // Submarket context for the engine: mirrors oms.ts seed path exactly.
      // isExpansion comes from the seeded submarket row when the OM's submarket
      // is one we know; unknown submarkets fall back via fallbackRentPsf.
      const submarket = parsed.property.submarket;
      const submarketRow = SUBMARKETS.find((s) => s.name === submarket);
      const isExpansion = submarketRow?.isExpansion ?? false;
      const propertyHasOffice = parsed.property.hasOffice === true;

      for (const u of parsed.units) {
        const unitId = id("unit");
        const annualRent =
          u.rentPerSqft != null && u.sizeSqft != null
            ? Math.round(u.rentPerSqft * u.sizeSqft)
            : null;
        const leaseStart = u.leaseStart ? new Date(u.leaseStart) : null;
        // built-out = property has office AND unit has private bathroom
        // (same signal oms.ts uses for the seed path)
        const isBuiltOut = propertyHasOffice && u.hasPrivateBathroom === true;
        const uw = synthesizeOmUw({
          rentPerSqft: u.rentPerSqft,
          sizeSqft: u.sizeSqft,
          annualRent,
          leaseStart,
          submarket,
          isBuiltOut,
          isExpansion,
          asOf: new Date().toISOString(),
        });
        tx.insert(schema.units).values({
          id: unitId,
          propertyId,
          suite: u.suite,
          sizeSqft: u.sizeSqft,
          leaseType: u.leaseType,
          hasPrivateBathroom: u.hasPrivateBathroom,
          currentRent: u.currentRent,
          rentPerSqft: u.rentPerSqft,
          annualRent,
          leaseStart,
          leaseEnd: u.leaseEnd ? new Date(u.leaseEnd) : null,
          tenantName: u.tenantName,
          tenantCategory: u.tenantCategory,
          ...uw,
        }).run();

        const confKey = `units.${u.suite ?? "?"}.rent`;
        const confEntry = parsed.confidence[confKey] ?? parsed.confidence["rent"];
        tx.insert(schema.compConfidence).values({
          id: id("cc"),
          unitId,
          rentConfidence: confEntry?.level ?? "low",
          sourceType: "om_rent_roll",
          rawQuote: u.rawQuote,
          extractedFromPage: u.extractedFromPage,
        }).run();
      }
    });

    await notify({
      kind: "extraction_complete",
      title: "OM ingested",
      body: parsed.property.name,
      link: "/market-intelligence",
    });

    return NextResponse.json({
      data: {
        propertyId,
        propertyName: parsed.property.name,
        unitCount: parsed.units.length,
        submarket: parsed.property.submarket,
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ingest-om] error:", message);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
