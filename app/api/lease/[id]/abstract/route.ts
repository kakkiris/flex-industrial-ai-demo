import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function hydrate(row: typeof schema.leaseAbstracts.$inferSelect) {
  return {
    ...row,
    baseRentSchedule: row.baseRentSchedule ? JSON.parse(row.baseRentSchedule) : [],
    escalations: row.escalations ? JSON.parse(row.escalations) : null,
    renewalOptions: row.renewalOptions ? JSON.parse(row.renewalOptions) : [],
    camTerms: row.camTerms ? JSON.parse(row.camTerms) : null,
    billingContact: row.billingContact ? JSON.parse(row.billingContact) : null,
    operatingExpenseRecovery: row.operatingExpenseRecovery
      ? JSON.parse(row.operatingExpenseRecovery)
      : null,
    specialProvisions: row.specialProvisions ? JSON.parse(row.specialProvisions) : [],
    extractionConfidence: row.extractionConfidence ? JSON.parse(row.extractionConfidence) : {},
    rawSections: row.rawSections ? JSON.parse(row.rawSections) : [],
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const rows = await db
      .select()
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.leaseId, id))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ data: null, error: "Abstract not found" }, { status: 404 });
    }
    return NextResponse.json({ data: hydrate(rows[0]), error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

const EDITABLE_TEXT_FIELDS = [
  "tenantName",
  "landlordName",
  "propertyAddress",
  "suite",
  "useClause",
] as const;
type EditableTextField = (typeof EDITABLE_TEXT_FIELDS)[number];

const EDITABLE_NUMERIC_FIELDS = ["tiAllowance", "freeRentMonths", "securityDeposit"] as const;
type EditableNumericField = (typeof EDITABLE_NUMERIC_FIELDS)[number];

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const update: Partial<typeof schema.leaseAbstracts.$inferInsert> = {};

    for (const f of EDITABLE_TEXT_FIELDS) {
      if (typeof body[f] === "string") {
        (update as Record<EditableTextField, string>)[f] = body[f] as string;
      }
    }
    for (const f of EDITABLE_NUMERIC_FIELDS) {
      if (typeof body[f] === "number") {
        (update as Record<EditableNumericField, number>)[f] = body[f] as number;
      }
    }
    if (Array.isArray(body.specialProvisions)) {
      update.specialProvisions = JSON.stringify(body.specialProvisions);
    }

    // Billing contact is edited as a single object (CommContacts Role=Billing).
    // Every field is nullable so an entity-only contact persists cleanly.
    // Accept an explicit null to clear the contact (body.billingContact === null)
    // as well as an object to update it.
    if (body.billingContact === null) {
      update.billingContact = null;
    } else if (body.billingContact !== undefined && typeof body.billingContact === "object") {
      const bc = body.billingContact as Record<string, unknown>;
      const str = (v: unknown): string | null =>
        typeof v === "string" && v.trim() !== "" ? v : null;
      update.billingContact = JSON.stringify({
        firstName: str(bc.firstName),
        lastName: str(bc.lastName),
        company: str(bc.company),
        phone: str(bc.phone),
        email: str(bc.email),
      });
    }
    if (typeof body.estimatedRecoveryPsf === "number") {
      update.estimatedRecoveryPsf = body.estimatedRecoveryPsf;
    }

    // Operating-expense recovery (Alex 4-Jun ask). Edited as a single object
    // (the "Recoveries" group). Merge the incoming partial onto the stored
    // value so editing one field on blur does not clobber the rest; coerce the
    // enum / numeric / array fields and accept null to clear sub-fields. An
    // explicit body.operatingExpenseRecovery === null clears the whole block.
    if (body.operatingExpenseRecovery === null) {
      update.operatingExpenseRecovery = null;
    } else if (
      body.operatingExpenseRecovery !== undefined &&
      typeof body.operatingExpenseRecovery === "object"
    ) {
      const existingRows = await db
        .select({ operatingExpenseRecovery: schema.leaseAbstracts.operatingExpenseRecovery })
        .from(schema.leaseAbstracts)
        .where(eq(schema.leaseAbstracts.leaseId, id))
        .limit(1);
      let current: Record<string, unknown> = {};
      const raw = existingRows[0]?.operatingExpenseRecovery;
      if (raw) {
        try {
          current = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          current = {};
        }
      }
      const incoming = body.operatingExpenseRecovery as Record<string, unknown>;
      const numOrNull = (v: unknown): number | null =>
        typeof v === "number" && !Number.isNaN(v) ? v : null;
      const strOrNull = (v: unknown): string | null =>
        typeof v === "string" && v.trim() !== "" ? v : null;
      const merged = { ...current, ...incoming };
      update.operatingExpenseRecovery = JSON.stringify({
        recoveryType: strOrNull(merged.recoveryType),
        baseYear: numOrNull(merged.baseYear),
        recoveryMethod: strOrNull(merged.recoveryMethod),
        proRataSharePct: numOrNull(merged.proRataSharePct),
        expenseCategories: Array.isArray(merged.expenseCategories)
          ? (merged.expenseCategories as unknown[]).map(String)
          : [],
        capPct: numOrNull(merged.capPct),
        reconciliationBasis: strOrNull(merged.reconciliationBasis),
        notes: strOrNull(merged.notes),
      });
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ data: null, error: "No editable fields provided" }, { status: 400 });
    }

    await db
      .update(schema.leaseAbstracts)
      .set(update)
      .where(eq(schema.leaseAbstracts.leaseId, id));

    const rows = await db
      .select()
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.leaseId, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ data: null, error: "Abstract not found" }, { status: 404 });
    }
    return NextResponse.json({ data: hydrate(rows[0]), error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
