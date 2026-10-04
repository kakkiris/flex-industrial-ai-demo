import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/anthropic", () => {
  const messages = {
    create: vi.fn(async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            // Tier 1
            businessType: "HVAC contractor",
            businessName: "Miller Brothers HVAC LLC",
            spaceSizeSqft: 1800,
            location: "Calder",
            // Tier 2
            timeline: "August 2026",
            leaseTermYears: 5,
            // Tier 3
            existingLocations: "existing",
            motivation: "outgrew current shop",
            loadingNeeds: "grade_level",
            callbackPreferred: false,
            summary: "Small HVAC firm needs a 1800 sqft NNN bay in Calder in August on a 5-year deal.",
            tierMap: {
              businessType: "tier1",
              businessName: "tier1",
              spaceSizeSqft: "tier1",
              location: "tier1",
              timeline: "tier2",
              leaseTermYears: "tier2",
              existingLocations: "tier3",
              motivation: "tier3",
              loadingNeeds: "tier3",
            },
            verdict: "qualified",
            confidenceScore: 88,
            reasoning: "HVAC contractor at 1800 sqft in Calder is a clean KFP fit.",
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 80 },
    })),
  };
  return {
    anthropic: () => ({ messages }),
    pickModel: () => "claude-sonnet-4-6",
    estimateCost: () => 0,
    logLLM: () => undefined,
  };
});

vi.mock("@/lib/notify", () => ({
  notify: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/chat/leasing/complete/route";
import { notify } from "@/lib/notify";
import { db, schema } from "@/db/client";
import { eq, inArray } from "drizzle-orm";

describe("POST /api/chat/leasing/complete", () => {
  beforeEach(async () => {
    // Clean up any prior leads from this test, respecting foreign key ordering.
    // chatSessions references leads, so remove child rows first.
    const chatLeads = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(eq(schema.leads.source, "chat"));
    if (chatLeads.length > 0) {
      await db
        .delete(schema.chatSessions)
        .where(inArray(schema.chatSessions.leadId, chatLeads.map((r) => r.id)));
    }
    await db.delete(schema.leads).where(eq(schema.leads.source, "chat"));
    vi.mocked(notify).mockClear();
  });

  it("inserts a lead row and returns its id", async () => {
    const req = new Request("http://localhost/api/chat/leasing/complete", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "test-session",
        transcript: [
          { role: "user", content: "I run an HVAC company and need 1800 sqft." },
          { role: "assistant", content: "Tell me your timeline." },
          { role: "user", content: "August 2026, around $13 per sqft NNN." },
        ],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.error).toBeNull();
    expect(json.data.leadId).toMatch(/^lead_/);

    const rows = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, json.data.leadId));
    expect(rows).toHaveLength(1);
    expect(rows[0].businessType).toBe("HVAC contractor");
    expect(rows[0].businessName).toBe("Miller Brothers HVAC LLC");
    expect(rows[0].spaceSizeSqft).toBe(1800);
    expect(rows[0].leaseTermYears).toBe(5);
    expect(rows[0].existingLocations).toBe("existing");
    expect(rows[0].loadingNeeds).toBe("grade_level");
    // tierMap is stored as a JSON string; parse and assert structure
    expect(rows[0].tierMap).toBeTruthy();
    const tierMap = JSON.parse(rows[0].tierMap as string);
    expect(tierMap.businessType).toBe("tier1");
    expect(tierMap.timeline).toBe("tier2");
    expect(tierMap.motivation).toBe("tier3");

    // The route must fire a qualified_lead notification on success with the
    // combined business name + type as the headline.
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "qualified_lead",
        title: "Miller Brothers HVAC LLC, HVAC contractor",
      })
    );
  });

  it("returns 400 when transcript is missing", async () => {
    const req = new Request("http://localhost/api/chat/leasing/complete", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
