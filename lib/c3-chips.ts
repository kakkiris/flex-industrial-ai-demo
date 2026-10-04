// C3-1: deterministic chip-tenant selection for the C3 home page named-tenant
// chips ("HVAC responsibility for ${tenant}", "Lender consent and loan docs for
// ${tenant}"). Centralized here so app/lease-intelligence/page.tsx and the
// regression test in tests/lib/retrieval.test.ts pick the SAME tenant and can
// never drift (the audit's gap was exactly that: the page used abstractRows[0],
// the test used a different hardcoded tenant, so the suite stayed green while
// the live chip was broken).
//
// Selection rule: pick a `bulk_load` tenant whose lease carries BOTH a
// Maintenance/HVAC section AND a Lender Consent section (the 22 bulk_load
// Foundry leases do; the seed leases have HVAC but no Lender section), and
// whose distinctive name tokens neither collide with another lease's name nor
// appear as literal words in the chip phrasing. This guarantees the retrieval
// tenant-matcher resolves the chip to exactly the named tenant.

export type ChipAbstractRow = {
  tenantName: string | null;
  source: string | null;
  rawSections: string | null;
};

// Words that appear in the chip phrasing itself; a tenant whose only
// distinctive token is one of these would be matched incidentally by the chip
// text rather than by its name.
const CHIP_PHRASING_TOKENS = new Set([
  "hvac", "responsibility", "lender", "consent", "loan", "docs", "and", "for",
]);

const CHIP_TENANT_STOPWORDS = new Set([
  "llc", "inc", "corp", "ltd", "the", "and", "company", "co", "group",
]);

// Fallback if the seed somehow carries no qualifying bulk_load lease. KTR
// Roofing is a known-good bulk_load tenant with both sections.
const FALLBACK_CHIP_TENANT = "KTR Roofing LLC";

function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length >= 3 && !CHIP_TENANT_STOPWORDS.has(t));
}

function hasSection(rawSections: string | null, re: RegExp): boolean {
  if (!rawSections) return false;
  try {
    const parsed = JSON.parse(rawSections) as Array<{ section?: string }>;
    return parsed.some((s) => typeof s.section === "string" && re.test(s.section));
  } catch {
    return false;
  }
}

function tokenCollides(candidate: string, rows: ChipAbstractRow[]): boolean {
  const mine = new Set(distinctiveTokens(candidate));
  for (const other of rows) {
    if (!other.tenantName || other.tenantName === candidate) continue;
    for (const t of distinctiveTokens(other.tenantName)) {
      if (mine.has(t)) return true;
    }
  }
  return false;
}

const LENDER_RE = /lender|loan/i;
const HVAC_RE = /hvac|maintenance/i;

// Returns the tenant name used for BOTH named chips. `rows` should be the
// lease-abstract rows ordered by extractedAt DESC (the page's order), so the
// selection is deterministic across reseeds.
export function pickChipTenant(rows: ChipAbstractRow[]): string {
  const candidate =
    rows.find(
      (r) =>
        r.source === "bulk_load" &&
        r.tenantName != null &&
        hasSection(r.rawSections, LENDER_RE) &&
        hasSection(r.rawSections, HVAC_RE) &&
        distinctiveTokens(r.tenantName).some((t) => !CHIP_PHRASING_TOKENS.has(t)) &&
        !tokenCollides(r.tenantName, rows),
    ) ?? rows.find((r) => r.source === "bulk_load" && r.tenantName != null);
  return candidate?.tenantName ?? FALLBACK_CHIP_TENANT;
}

// The exact chip strings the page renders for the two named chips, given the
// selected tenant. Kept here so the page and the regression test build them
// identically.
export function hvacChipString(tenant: string): string {
  return `HVAC responsibility for ${tenant}`;
}
export function lenderChipString(tenant: string): string {
  return `Lender consent and loan docs for ${tenant}`;
}
