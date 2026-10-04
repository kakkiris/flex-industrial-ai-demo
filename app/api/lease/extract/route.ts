import { NextResponse } from "next/server";
import path from "node:path";
import Database from "better-sqlite3";
import { db, schema } from "@/db/client";
import {
  extractWithVision,
  extractWithText,
  routeExtraction,
  savePdfToUploads,
} from "@/lib/pdf";
import { extractLeasePrompt, LeaseAbstract } from "@/lib/prompts/extract-lease";
import { notify } from "@/lib/notify";
import { id } from "@/lib/ids";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const knownAddress = (form.get("knownAddress") as string | null) ?? undefined;
    if (!(file instanceof File)) {
      return NextResponse.json({ data: null, error: "file field required" }, { status: 400 });
    }

    const relativePath = await savePdfToUploads(file, "leases");
    const absolutePath = path.resolve(process.cwd(), relativePath);

    // Dual-path extraction: probe page-1 text density first. Text-native PDFs
    // (e.g. KFP form lease) take the unpdf + Sonnet path; fully-scanned PDFs
    // (e.g. Legacy lease) take the Opus 4.7 native PDF vision path.
    const extractionPath = await routeExtraction(absolutePath);
    const { system, user } = extractLeasePrompt({ knownAddress });

    const result =
      extractionPath === "text"
        ? await extractWithText({
            filePath: absolutePath,
            systemPrompt: system,
            userPrompt: (txt) => `${user}\n\nLease text (extracted from PDF):\n${txt}`,
            tier: "default",
            parse: (json) => LeaseAbstract.parse(JSON.parse(json)),
          })
        : await extractWithVision({
            filePath: absolutePath,
            systemPrompt: system,
            userPrompt: user,
            tier: "high-stakes",
            parse: (json) => LeaseAbstract.parse(JSON.parse(json)),
          });
    const parsed = result.data;

    const leaseId = id("lease");
    const abstractId = id("abs");

    db.transaction((tx) => {
      tx.insert(schema.leases).values({
        id: leaseId,
        unitId: null,
        pdfPath: relativePath,
        ingestedAt: new Date(),
      }).run();

      tx.insert(schema.leaseAbstracts).values({
        id: abstractId,
        leaseId,
        tenantName: parsed.tenantName,
        landlordName: parsed.landlordName,
        propertyAddress: parsed.propertyAddress,
        suite: parsed.suite,
        leaseStart: new Date(parsed.leaseStart),
        leaseEnd: new Date(parsed.leaseEnd),
        baseRentSchedule: JSON.stringify(parsed.baseRentSchedule),
        escalations: JSON.stringify(parsed.escalations),
        renewalOptions: JSON.stringify(parsed.renewalOptions),
        tiAllowance: parsed.tiAllowancePerSqft,
        freeRentMonths: parsed.freeRentMonths,
        securityDeposit: parsed.securityDeposit,
        camTerms: JSON.stringify(parsed.cam),
        billingContact: parsed.billingContact ? JSON.stringify(parsed.billingContact) : null,
        estimatedRecoveryPsf: parsed.estimatedRecoveryPsf,
        useClause: parsed.useClause,
        specialProvisions: JSON.stringify(parsed.specialProvisions),
        extractionConfidence: JSON.stringify(parsed.confidence),
        extractionPath,
        rawSections: JSON.stringify(parsed.rawSections),
        extractedAt: new Date(),
        // L2-3 fix: an uploaded lease must land in the review queue, not skip
        // straight to "pushed". This manual upload of the signed (DocuSign)
        // PDF is the only lease-intake path in the demo.
        source: "upload",
        status: "awaiting_review",
      }).run();
    });

    // FTS5 is a virtual table; populate via the raw sqlite handle (db.client doesn't
    // expose it, so we open a separate connection just for the FTS insert). Use the
    // same DATABASE_URL the migration uses.
    const url = (process.env.DATABASE_URL ?? "file:./db/kfp-demo.db").replace(/^file:/, "");
    const sqlite = new Database(path.resolve(process.cwd(), url));
    try {
      const stmt = sqlite.prepare(
        "INSERT INTO lease_sections_fts (lease_id, section, page, text) VALUES (?, ?, ?, ?)"
      );
      for (const s of parsed.rawSections) {
        stmt.run(leaseId, s.section, s.page, s.text);
      }
    } finally {
      sqlite.close();
    }

    await notify({
      kind: "extraction_complete",
      title: "Lease abstract ready",
      body: `${parsed.tenantName} - Suite ${parsed.suite}`,
      link: "/lease-abstraction",
    });

    return NextResponse.json({
      data: { leaseId, abstractId, abstract: parsed, extractionPath, meta: result.meta },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lease/extract] error:", message);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
