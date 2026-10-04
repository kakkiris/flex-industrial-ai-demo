import { describe, it, expect } from "vitest";
import { isNull } from "drizzle-orm";
import { GET } from "@/app/api/lease/[id]/section/[section]/route";
import { db, schema } from "@/db/client";

// C3-2: the expiration-schedule and availability answers cite "(system)" /
// page-0 rows that the section route used to be unable to resolve (it only
// found real rawSections), so clicking them 404'd and the client silently
// no-op'd. These tests pin that system citations reconstruct and availability
// citations resolve from the units table, so a click is never a silent dead
// end.

function makeContext(id: string, section: string) {
  return {
    params: Promise.resolve({ id, section: encodeURIComponent(section) }),
  };
}

describe("lease section route: C3-2 resolvable citations", () => {
  it("resolves a real rawSection (the existing happy path)", async () => {
    const abs = (
      await db.select().from(schema.leaseAbstracts).limit(1)
    )[0];
    const sections = JSON.parse(abs.rawSections ?? "[]") as Array<{
      section: string;
    }>;
    const res = await GET(
      new Request("http://test"),
      makeContext(abs.leaseId!, sections[0].section),
    );
    const json = (await res.json()) as {
      data: { section: string; text: string } | null;
      error: string | null;
    };
    expect(res.status).toBe(200);
    expect(json.data).not.toBeNull();
    expect(json.data!.section).toBe(sections[0].section);
  });

  it("reconstructs a 'Lease Dates (system)' citation instead of 404ing", async () => {
    const abs = (
      await db.select().from(schema.leaseAbstracts).limit(1)
    )[0];
    const res = await GET(
      new Request("http://test"),
      makeContext(abs.leaseId!, "Lease Dates (system)"),
    );
    const json = (await res.json()) as {
      data: { section: string; text: string } | null;
      error: string | null;
    };
    expect(res.status).toBe(200);
    expect(json.data).not.toBeNull();
    expect(json.data!.section).toBe("Lease Dates (system)");
    expect(/Lease start date|Lease end date/i.test(json.data!.text)).toBe(true);
  });

  it("reconstructs a 'Rent Schedule (system)' citation", async () => {
    const abs = (
      await db.select().from(schema.leaseAbstracts).limit(1)
    )[0];
    const res = await GET(
      new Request("http://test"),
      makeContext(abs.leaseId!, "Rent Schedule (system)"),
    );
    const json = (await res.json()) as {
      data: { text: string } | null;
      error: string | null;
    };
    expect(res.status).toBe(200);
    expect(json.data).not.toBeNull();
    expect(/rent/i.test(json.data!.text)).toBe(true);
  });

  it("resolves an 'Available Unit (system)' citation from a vacant unitId", async () => {
    const vacant = (
      await db
        .select()
        .from(schema.units)
        .where(isNull(schema.units.tenantName))
        .limit(1)
    )[0];
    const res = await GET(
      new Request("http://test"),
      makeContext(vacant.id, "Available Unit (system)"),
    );
    const json = (await res.json()) as {
      data: { section: string; text: string } | null;
      error: string | null;
    };
    expect(res.status).toBe(200);
    expect(json.data).not.toBeNull();
    expect(json.data!.section).toBe("Available Unit (system)");
    expect(/available to rent/i.test(json.data!.text)).toBe(true);
  });
});
