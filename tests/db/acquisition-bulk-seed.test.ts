import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import { db, schema } from "@/db/client";
import { eq, and, isNull, isNotNull, like } from "drizzle-orm";

// Asserts the Foundry acquisition bulk-load (A5, Task C.2) seeded correctly:
// >= 20 bulk_load lease abstracts, a Lender Consent rawSection on inherited
// leases, the Foundry property with both occupied and vacant units, and the
// bulk_load lease sections present in the lease_sections_fts virtual table.
//
// Requires a seeded DB (run `pnpm db:reset` first); the suite runs against the
// committed dev DB the same way the other DB-backed tests do.

function openSqlite() {
  const url = (process.env.DATABASE_URL ?? "file:./db/kfp-demo.db").replace(
    /^file:/,
    "",
  );
  return new Database(path.resolve(process.cwd(), url));
}

describe("acquisition bulk-load seed (Foundry)", () => {
  it("seeds at least 20 lease abstracts with source bulk_load", () => {
    const rows = db
      .select({ id: schema.leaseAbstracts.id })
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.source, "bulk_load"))
      .all();
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  it("has at least one bulk_load abstract with a Lender Consent rawSection", () => {
    const rows = db
      .select({ rawSections: schema.leaseAbstracts.rawSections })
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.source, "bulk_load"))
      .all();

    const withLenderSection = rows.filter((r) => {
      const sections: Array<{ section: string; text: string }> = JSON.parse(
        r.rawSections ?? "[]",
      );
      return sections.some((s) => /lender consent/i.test(s.section));
    });
    expect(withLenderSection.length).toBeGreaterThan(0);
  });

  it("has at least one bulk_load abstract with a Maintenance and HVAC Responsibility rawSection", () => {
    const rows = db
      .select({ rawSections: schema.leaseAbstracts.rawSections })
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.source, "bulk_load"))
      .all();

    const withHvacSection = rows.filter((r) => {
      const sections: Array<{ section: string; text: string }> = JSON.parse(
        r.rawSections ?? "[]",
      );
      return sections.some((s) => /maintenance.*hvac/i.test(s.section));
    });
    expect(withHvacSection.length).toBeGreaterThan(0);
  });

  it("seeds the Foundry property with both occupied and vacant units", () => {
    const props = db
      .select({ id: schema.properties.id, name: schema.properties.name })
      .from(schema.properties)
      .where(like(schema.properties.name, "%Foundry%"))
      .all();
    expect(props.length).toBe(1);
    const propertyId = props[0].id;

    const occupied = db
      .select({ id: schema.units.id })
      .from(schema.units)
      .where(
        and(
          eq(schema.units.propertyId, propertyId),
          isNotNull(schema.units.tenantName),
        ),
      )
      .all();
    expect(occupied.length).toBeGreaterThanOrEqual(20);

    const vacant = db
      .select({ id: schema.units.id })
      .from(schema.units)
      .where(
        and(
          eq(schema.units.propertyId, propertyId),
          isNull(schema.units.tenantName),
        ),
      )
      .all();
    expect(vacant.length).toBeGreaterThan(0);
    // Vacant shells read as available-to-rent: tenantName null, rentPerSqft null.
    const vacantWithRent = db
      .select({ id: schema.units.id })
      .from(schema.units)
      .where(
        and(
          eq(schema.units.propertyId, propertyId),
          isNull(schema.units.tenantName),
          isNotNull(schema.units.rentPerSqft),
        ),
      )
      .all();
    expect(vacantWithRent.length).toBe(0);
  });

  it("Foundry in-place rents are ~$16.5-19 and read below market", () => {
    const rows = db.select({ rent: schema.units.rentPerSqft, perf: schema.units.performanceToUw })
      .from(schema.units).innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
      .where(eq(schema.properties.name, "Foundry Business Center")).all();
    const leased = rows.filter((r) => r.rent != null);
    for (const r of leased) { expect(r.rent!).toBeGreaterThanOrEqual(15.5); expect(r.rent!).toBeLessThanOrEqual(19.5); }
    expect(leased.some((r) => (r.perf ?? 0) < 0)).toBe(true); // below market
  });

  it("indexes the bulk_load lease sections in lease_sections_fts", () => {
    const sqlite = openSqlite();
    try {
      // A Foundry tenant token should resolve to indexed FTS sections.
      const brightline = sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM lease_sections_fts WHERE lease_sections_fts MATCH ?",
        )
        .get("Brightline") as { n: number };
      expect(brightline.n).toBeGreaterThan(0);

      // The Foundry address token should also be present across the
      // bulk_load sections.
      const foundry = sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM lease_sections_fts WHERE lease_sections_fts MATCH ?",
        )
        .get("Foundry") as { n: number };
      expect(foundry.n).toBeGreaterThan(0);
    } finally {
      sqlite.close();
    }
  });
});
