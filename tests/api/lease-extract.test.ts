import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";

const fixtureAbstract = {
  tenantName: "Test HVAC Co",
  landlordName: "KFP Test LLC",
  propertyAddress: "100 Test Industrial Way, Brightwater, TX",
  suite: "101",
  leaseStart: "2026-09-01",
  leaseEnd: "2031-08-31",
  baseRentSchedule: [
    { from: "2026-09-01", to: "2027-08-31", monthlyRent: 2000, annualRentPerSqft: 13 },
  ],
  escalations: { type: "fixed_pct" as const, details: "3% annual" },
  renewalOptions: [],
  tiAllowancePerSqft: 5,
  freeRentMonths: 0,
  securityDeposit: 4000,
  cam: { type: "NNN" as const, recoveryMethod: "pro-rata", caps: null },
  billingContact: { firstName: "Pat", lastName: "Nguyen", company: "Test HVAC Co", phone: "(555) 555-0100", email: "ap@testhvac.example.com" },
  estimatedRecoveryPsf: null,
  useClause: "HVAC fabrication",
  specialProvisions: [],
  rawSections: [
    { section: "1. Use Clause", page: 3, text: "Tenant uses for HVAC ..." },
    { section: "4. Base Rent", page: 5, text: "Annual base rent is ..." },
    { section: "9. CAM", page: 12, text: "Pro-rata share of CAM ..." },
  ],
  confidence: {
    tenantName: { level: "high" as const },
    baseRentSchedule: { level: "high" as const },
  },
};

vi.mock("@/lib/pdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf")>("@/lib/pdf");
  return {
    ...actual,
    savePdfToUploads: vi.fn(async () => "uploads/leases/test-lease.pdf"),
    extractWithVision: vi.fn(async ({ parse }: { parse: (s: string) => unknown }) => ({
      data: parse(JSON.stringify(fixtureAbstract)),
      meta: { model: "claude-opus-4-7", latencyMs: 100 },
    })),
  };
});

vi.mock("@/lib/notify", () => ({
  notify: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/lease/extract/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";

describe("POST /api/lease/extract", () => {
  beforeEach(async () => {
    // Clean any abstracts from a prior run of THIS test. Match on the fixture tenant.
    const targets = await db
      .select({ id: schema.leases.id })
      .from(schema.leaseAbstracts)
      .innerJoin(schema.leases, eq(schema.leases.id, schema.leaseAbstracts.leaseId))
      .where(eq(schema.leaseAbstracts.tenantName, fixtureAbstract.tenantName));
    for (const t of targets) {
      await db.delete(schema.leaseAbstracts).where(eq(schema.leaseAbstracts.leaseId, t.id));
      await db.delete(schema.leases).where(eq(schema.leases.id, t.id));
      const sqlite = new Database(path.resolve(process.cwd(), "db/kfp-demo.db"));
      try {
        sqlite.prepare("DELETE FROM lease_sections_fts WHERE lease_id = ?").run(t.id);
      } finally {
        sqlite.close();
      }
    }
  });

  it("inserts a lease, abstract, and FTS rows when given a PDF", async () => {
    // Build a multipart Request body that the route's formData() can read.
    const form = new FormData();
    const fakePdf = new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" });
    form.set("file", fakePdf);
    form.set("knownAddress", "100 Test Industrial Way");

    const req = new Request("http://localhost/api/lease/extract", {
      method: "POST",
      body: form,
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(json.data.leaseId).toMatch(/^lease_/);

    const leases = await db
      .select()
      .from(schema.leases)
      .where(eq(schema.leases.id, json.data.leaseId));
    expect(leases).toHaveLength(1);

    const abstracts = await db
      .select()
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.leaseId, json.data.leaseId));
    expect(abstracts).toHaveLength(1);
    expect(abstracts[0].tenantName).toBe("Test HVAC Co");

    // L2-3: an uploaded lease must land in the review queue, stamped as an
    // upload, never bypassing review to read as already activated in Yardi.
    expect(abstracts[0].source).toBe("upload");
    expect(abstracts[0].status).toBe("awaiting_review");
    expect(abstracts[0].pushedToYardiAt).toBeNull();

    // The billing contact is persisted as JSON for the Yardi CommContacts row.
    expect(abstracts[0].billingContact).not.toBeNull();
    const bc = JSON.parse(abstracts[0].billingContact as string);
    expect(bc.company).toBe("Test HVAC Co");

    const sqlite = new Database(path.resolve(process.cwd(), "db/kfp-demo.db"));
    const fts = sqlite
      .prepare("SELECT COUNT(*) as n FROM lease_sections_fts WHERE lease_id = ?")
      .get(json.data.leaseId) as { n: number };
    sqlite.close();
    expect(fts.n).toBe(3);
  });

  it("returns 400 without a file field", async () => {
    const form = new FormData();
    const req = new Request("http://localhost/api/lease/extract", {
      method: "POST",
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
