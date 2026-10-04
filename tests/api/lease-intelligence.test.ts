import { describe, it, expect, beforeEach, vi } from "vitest";

const canned = {
  answer: "Per Section 7, HVAC is the tenant's responsibility.",
  citations: [
    {
      leaseId: "lease_seed_1",
      section: "7. Maintenance and HVAC",
      page: 12,
      quote: "Tenant is responsible for HVAC maintenance ...",
    },
  ],
  table: null,
};

// Canned structured-schedule answer (D.1). Returned when the prompt context
// carries an "Expiration Schedule (system)" section, mirroring how the real
// model would fill the structured `schedule` field for a per-property
// expiration question.
const cannedSchedule = {
  answer: "Here is the tenant expiration schedule for the Foundry property.",
  citations: [],
  table: null,
  schedule: [
    {
      propertyAddress: "1500 Foundry Avenue, Olmstead, TX 78475",
      tenant: "Brightline Lighting Supply Inc",
      suite: "A1",
      leaseEnd: "2028-12-31",
      daysToExpiry: 945,
      renewalOption: "None on record",
    },
  ],
};

// Canned loan-doc answer (D.2) with a citation to a real Lender Consent
// rawSection (page > 0).
const cannedLoanDoc = {
  answer: "Yes, the lease is subject to lender consent and an SNDA.",
  citations: [
    {
      leaseId: "lease_seed_loan",
      section: "Lender Consent and Loan Documents",
      page: 4,
      quote: "This Lease is subject to lender consent and to an SNDA ...",
    },
  ],
  table: null,
  schedule: null,
};

// The mock inspects the user prompt (which embeds the retrieved context) and
// returns the query-appropriate canned response so we can exercise each branch
// without a real LLM call.
function pickCanned(userPrompt: string): unknown {
  if (/Expiration Schedule \(system\)/.test(userPrompt)) return cannedSchedule;
  if (/Lender Consent and Loan Documents/.test(userPrompt)) return cannedLoanDoc;
  return canned;
}

vi.mock("@/lib/anthropic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anthropic")>("@/lib/anthropic");
  return {
    ...actual,
    anthropic: () => ({
      messages: {
        create: vi.fn(async (args: { messages: Array<{ content: string }> }) => {
          const userPrompt = args.messages?.[0]?.content ?? "";
          return {
            content: [{ type: "text", text: JSON.stringify(pickCanned(userPrompt)) }],
            usage: { input_tokens: 100, output_tokens: 80 },
          };
        }),
      },
    }),
  };
});

import { POST } from "@/app/api/lease/intelligence/route";
import { db, schema } from "@/db/client";
import { desc, eq } from "drizzle-orm";

describe("POST /api/lease/intelligence", () => {
  beforeEach(async () => {
    // Clear any query log rows from this test.
    await db.delete(schema.queryLog).where(eq(schema.queryLog.query, "Who handles HVAC?"));
  });

  it("returns an answer + citations and logs the query", async () => {
    const req = new Request("http://localhost/api/lease/intelligence", {
      method: "POST",
      body: JSON.stringify({ query: "Who handles HVAC?" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(json.data.answer).toMatch(/HVAC/);
    expect(json.data.citations).toHaveLength(1);
    expect(typeof json.data.responseTimeMs).toBe("number");

    const log = await db
      .select()
      .from(schema.queryLog)
      .where(eq(schema.queryLog.query, "Who handles HVAC?"))
      .orderBy(desc(schema.queryLog.timestamp))
      .limit(1);
    expect(log).toHaveLength(1);
  });

  it("returns 400 with missing query", async () => {
    const req = new Request("http://localhost/api/lease/intelligence", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // D.1 + D.4: the per-property expiration branch surfaces the grouped
  // Expiration Schedule (system) context, so the model fills the structured
  // `schedule` field, and the route returns it parsed.
  it("returns a parsed structured schedule for a per-property expiration query", async () => {
    const req = new Request("http://localhost/api/lease/intelligence", {
      method: "POST",
      body: JSON.stringify({
        query: "Per-property tenant expiration schedule for the Foundry property at 1500 Foundry Avenue",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(Array.isArray(json.data.schedule)).toBe(true);
    expect(json.data.schedule.length).toBeGreaterThan(0);
    expect(json.data.schedule[0].propertyAddress).toMatch(/Foundry/);
  });

  // D.2 + D.4: the loan-doc branch surfaces the real Lender Consent rawSection,
  // so the model returns a citation to it.
  it("returns a citation for a lender-consent / loan-doc query", async () => {
    const req = new Request("http://localhost/api/lease/intelligence", {
      method: "POST",
      body: JSON.stringify({
        query: "Is lender consent required for the KTR Roofing lease?",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(json.data.citations.length).toBeGreaterThan(0);
    expect(json.data.citations[0].section).toMatch(/lender|loan|consent/i);
  });

  // The no-500 guarantee: a question that omits the schedule field must still
  // parse and return 200, schedule absent or null.
  it("does not 500 when the model omits the optional schedule field", async () => {
    const req = new Request("http://localhost/api/lease/intelligence", {
      method: "POST",
      body: JSON.stringify({ query: "Who handles HVAC?" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(json.data.schedule ?? null).toBeNull();
  });
});
