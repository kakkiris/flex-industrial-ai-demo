import Database from "better-sqlite3";
import path from "node:path";
import { db, schema } from "@/db/client";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { noiLiftFromExpirations } from "@/lib/uw";
import { getUwAssumptions, FOUNDRY_UW } from "@/lib/uw-assumptions";

export type LeaseSectionResult = {
  leaseId: string;
  tenantName: string | null;
  section: string;
  page: number;
  text: string;
  snippet: string;
};

// D.3: a vacant, available-to-rent unit (units.tenantName IS NULL). Kept as a
// shape distinct from LeaseSectionResult so the availability answer context and
// the lease-section citation list do not mix shapes confusingly.
export type AvailableUnitResult = {
  unitId: string;
  propertyName: string | null;
  propertyAddress: string | null;
  suite: string | null;
  sizeSqft: number | null;
  leaseType: string | null;
  tenantName: null;
};

export type RetrievalOptions = {
  k?: number;
  // When set, retrieval is scoped to a single lease (deep-link from L2's
  // "Ask C3 about this lease" button). Synthesizes system sections for that
  // lease unconditionally so questions about dates / rent / deposit always
  // have authoritative content to cite.
  leaseId?: string | null;
};

function openSqlite() {
  const url = (process.env.DATABASE_URL ?? "file:./db/kfp-demo.db").replace(/^file:/, "");
  return new Database(path.resolve(process.cwd(), url));
}

// Common English words that show up in chat queries but pollute FTS results
// when used as positive search terms (every lease section contains "tenant",
// "lease", "rent" already).
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "have", "has", "this", "that",
  "these", "those", "what", "which", "where", "when", "how", "are",
  "any", "all", "across", "into", "out", "you", "your", "ours", "our",
  "give", "show", "tell", "list", "compare", "summary", "summarize",
  "portfolio", "lease", "leases", "tenant", "tenants",
]);

function buildFtsQuery(input: string): string {
  const tokens = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (tokens.length === 0) return input;
  return tokens.map((t) => `${t}*`).join(" OR ");
}

function mentionsExpiration(q: string): boolean {
  return /\bexpir|\brenewal|\bexpiration/i.test(q);
}
function mentionsNetEffectiveRent(q: string): boolean {
  return /\bnet effective|\bner\b|\bfree rent|\bti allowance|\btenant improvement/i.test(q);
}
function mentionsDates(q: string): boolean {
  return /\bdate|\bstart|\bend\b|\bterm\b|\bcommence|\bwhen\b|\bduration/i.test(q);
}
function mentionsRent(q: string): boolean {
  return /\brent|\bmonthly|\bannual|\bbase rent|\bpsf\b|\b\$\/sqft|\bpayment/i.test(q);
}
function mentionsDeposit(q: string): boolean {
  return /\bdeposit|\bsecurity/i.test(q);
}
// Loan-document / lender-consent intent (D.2). Anchored to lender/loan/debt
// vocabulary so it does NOT collide with the NER `ti allowance` / `free rent`
// classifier or the expiration classifier. "consent" is only matched when it
// reads as lender/landlord consent, not generic consent.
function mentionsLoanDocs(q: string): boolean {
  return /\blender|\bloan doc|\bmortgage|\bdeed of trust|\bestoppel|\bsnda\b|\bsubordinat|\bnon-disturbance|\bnondisturbance|\battornment|lender consent|loan document/i.test(
    q,
  );
}
// Operating-expense recovery intent (Alex's 4-Jun ask). Fires on recovery /
// pass-through / base-year / CAM-reconciliation vocabulary so the recovery
// side-path can pull the "Operating Expenses / Additional Rent" rawSections for
// the LLM to cite. Exported because the C6 test asserts the classifier directly.
export function mentionsRecovery(query: string): boolean {
  return /operating expense|opex|recover|pass[- ]?through|base year|reconcil|cam|estutil|additional rent/i.test(query);
}
// Availability intent (D.3): "what is empty and rentable". Anchored to
// vacancy / availability vocabulary; does not overlap the rent / expiration
// classifiers because it keys on empty / vacant / available / rentable.
function mentionsAvailability(q: string): boolean {
  return /\bvacan|\bavailab|\bempty\b|\brentable\b|\bunoccupied\b|\bopen units?\b|\bwhat'?s empty/i.test(
    q,
  );
}

function fmtDate(d: Date | null): string {
  if (!d) return "unknown";
  return d.toISOString().slice(0, 10);
}

// C3-1b: map a named-tenant query to a section-heading regex so the pin can
// surface the right clause of the named lease (HVAC, lender, rent, dates,
// deposit, renewal). Returns null when the query has no clear section intent,
// in which case the pin falls back to every section of the named lease.
function buildPinSectionMatcher(query: string): RegExp | null {
  const clauses: string[] = [];
  if (/\bhvac|\bmaintenance|\brepair|\broof/i.test(query)) clauses.push("hvac|maintenance|repair|roof");
  if (mentionsLoanDocs(query)) clauses.push("lender|loan|mortgage|estoppel|snda|subordinat|attornment|non-disturbance");
  if (mentionsRent(query) || mentionsNetEffectiveRent(query)) clauses.push("rent|escalation|free rent|tenant improvement");
  if (mentionsDates(query) || mentionsExpiration(query)) clauses.push("date|term|renewal|expiration");
  if (mentionsDeposit(query)) clauses.push("deposit|security");
  if (clauses.length === 0) return null;
  return new RegExp(clauses.join("|"), "i");
}

// Normalize a query for substring matching: lowercase, collapse non-alphanum
// to single spaces. Used by the property / lease matchers so "Foundry
// Avenue" or "KTR Roofing" survive punctuation differences.
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// D.1: find the property addresses referenced by the query. A property matches
// when a distinctive token from its address (the street name, e.g. "foundry")
// appears in the query. Returns the full propertyAddress strings.
function matchPropertiesInQuery<T extends { propertyAddress: string | null }>(
  query: string,
  abstractByLease: Map<string, T>,
): string[] {
  const q = normalizeForMatch(query);
  const matched = new Set<string>();
  for (const a of abstractByLease.values()) {
    if (!a.propertyAddress) continue;
    // Distinctive address tokens (drop the city / state / zip noise and short
    // generic words like "avenue", "street").
    const tokens = normalizeForMatch(a.propertyAddress)
      .split(" ")
      .filter((t) => t.length >= 4 && !ADDRESS_STOPWORDS.has(t));
    if (tokens.some((t) => q.includes(t))) matched.add(a.propertyAddress);
  }
  return Array.from(matched);
}

const ADDRESS_STOPWORDS = new Set([
  "avenue", "street", "drive", "road", "boulevard", "blvd", "lane", "court",
  "suite", "unit", "industrial", "south", "north", "east", "west", "marisol",
]);

// D.2: find the lease ids referenced by the query, matched on the tenant name.
// A lease matches when a distinctive token of its tenant name (>= 4 chars)
// appears in the query (e.g. "KTR Roofing" -> "roofing", "ktr").
function matchLeasesInQuery<T extends { tenantName: string | null }>(
  query: string,
  abstractByLease: Map<string, T>,
): string[] {
  const q = normalizeForMatch(query);
  const matched: string[] = [];
  for (const [leaseId, a] of abstractByLease) {
    if (!a.tenantName) continue;
    const tokens = normalizeForMatch(a.tenantName)
      .split(" ")
      .filter((t) => t.length >= 3 && !TENANT_STOPWORDS.has(t));
    if (tokens.some((t) => q.includes(t))) matched.push(leaseId);
  }
  return matched;
}

const TENANT_STOPWORDS = new Set([
  "llc", "inc", "corp", "ltd", "the", "and", "company", "co", "group",
]);

// Domain vocabulary that can appear in a chip/question independent of any
// tenant name (e.g. "HVAC responsibility for ...", "Lender consent and loan
// docs for ..."). A tenant whose ONLY matching token is one of these (e.g.
// "Gulf Coast HVAC Solutions" matched by the literal word "hvac") is a weak,
// incidental match; the named-tenant pin (C3-1b) must prefer a tenant matched
// by genuinely distinctive tokens (e.g. "Copper Loop") over such a match.
const DOMAIN_MATCH_WORDS = new Set([
  "hvac", "maintenance", "lender", "loan", "consent", "docs", "doc",
  "rent", "lease", "renewal", "deposit", "expiration", "expiring",
]);

// C3-1b: rank the leases referenced by the query by how distinctively the query
// names them. The score counts matching tokens, weighting non-domain tokens
// above incidental domain-word matches, so "HVAC responsibility for Copper
// Loop LLC" resolves to Copper Loop (two distinctive tokens) ahead of "Gulf
// Coast HVAC Solutions" (matched only by the incidental domain word "hvac").
// Returns lease ids ordered best-match first; ties keep map order.
function rankLeasesInQuery<T extends { tenantName: string | null }>(
  query: string,
  abstractByLease: Map<string, T>,
): string[] {
  const q = normalizeForMatch(query);
  const scored: Array<{ leaseId: string; score: number }> = [];
  for (const [leaseId, a] of abstractByLease) {
    if (!a.tenantName) continue;
    const tokens = normalizeForMatch(a.tenantName)
      .split(" ")
      .filter((t) => t.length >= 3 && !TENANT_STOPWORDS.has(t));
    let distinctive = 0;
    let incidental = 0;
    for (const t of tokens) {
      if (!q.includes(t)) continue;
      if (DOMAIN_MATCH_WORDS.has(t)) incidental += 1;
      else distinctive += 1;
    }
    const score = distinctive * 10 + incidental;
    if (score > 0) scored.push({ leaseId, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.leaseId);
}

// Summarize the structured renewalOptions JSON into a short human label for the
// per-property schedule. Mirrors the system-section logic but returns a plain
// string for the grouped block.
function renewalSummary(renewalOptions: string | null): string {
  if (!renewalOptions) return "None on record";
  try {
    const opts = JSON.parse(renewalOptions);
    if (typeof opts === "string") return opts || "None on record";
    if (Array.isArray(opts)) return opts.length > 0 ? JSON.stringify(opts) : "None on record";
    return "None on record";
  } catch {
    return "None on record";
  }
}

type AbstractRow = {
  leaseId: string;
  tenantName: string | null;
  suite: string | null;
  propertyAddress: string | null;
  leaseStart: Date | null;
  leaseEnd: Date | null;
  baseRentSchedule: string | null;
  securityDeposit: number | null;
  tiAllowance: number | null;
  freeRentMonths: number | null;
  renewalOptions: string | null;
};

// Build authoritative "system" sections from the structured abstract fields.
// These cover what the LLM gets wrong when relying on FTS alone, lease dates,
// rent schedule, and concessions all live in structured columns on
// `leaseAbstracts`, not as free-text in `rawSections`, so an FTS query for
// "monthly rent" used to match unrelated mentions in Insurance or CAM clauses.
function buildSystemSectionsForLease(abs: AbstractRow): LeaseSectionResult[] {
  const out: LeaseSectionResult[] = [];
  const tenant = abs.tenantName ?? "Unknown tenant";
  const where = [abs.suite ? `Suite ${abs.suite}` : null, abs.propertyAddress].filter(Boolean).join(", ");

  // Lease Dates
  out.push({
    leaseId: abs.leaseId,
    tenantName: abs.tenantName,
    section: "Lease Dates (system)",
    page: 0,
    text:
      `Tenant: ${tenant}. ${where ? `Premises: ${where}. ` : ""}` +
      `Lease start date: ${fmtDate(abs.leaseStart)}. ` +
      `Lease end date: ${fmtDate(abs.leaseEnd)}.`,
    snippet: `${fmtDate(abs.leaseStart)} to ${fmtDate(abs.leaseEnd)}`,
  });

  // Rent Schedule from baseRentSchedule JSON
  if (abs.baseRentSchedule) {
    try {
      const schedule = JSON.parse(abs.baseRentSchedule) as Array<{
        from: string;
        to: string;
        monthlyRent: number | null;
        annualRentPerSqft: number | null;
      }>;
      if (Array.isArray(schedule) && schedule.length > 0) {
        const lines = schedule.map((s) => {
          const monthly = s.monthlyRent != null ? `$${s.monthlyRent.toLocaleString()}/month` : "monthly rent not stated";
          const psf = s.annualRentPerSqft != null ? `$${s.annualRentPerSqft.toFixed(2)}/sqft annual` : "$/sqft not stated";
          return `From ${s.from} to ${s.to}: ${monthly}; ${psf}.`;
        });
        out.push({
          leaseId: abs.leaseId,
          tenantName: abs.tenantName,
          section: "Rent Schedule (system)",
          page: 0,
          text: `Tenant: ${tenant}. Base rent schedule:\n${lines.join("\n")}`,
          snippet: lines[0],
        });
      }
    } catch {
      // malformed JSON: skip, FTS may still cover it
    }
  }

  // Deposit + Concessions
  const con: string[] = [];
  if (abs.securityDeposit != null) con.push(`Security deposit: $${abs.securityDeposit.toLocaleString()}.`);
  if (abs.tiAllowance != null) con.push(`Tenant improvement allowance: $${abs.tiAllowance.toFixed(2)}/sqft.`);
  if (abs.freeRentMonths != null) con.push(`Free rent: ${abs.freeRentMonths} months.`);
  if (con.length > 0) {
    out.push({
      leaseId: abs.leaseId,
      tenantName: abs.tenantName,
      section: "Deposit & Concessions (system)",
      page: 0,
      text: `Tenant: ${tenant}. ${con.join(" ")}`,
      snippet: con[0],
    });
  }

  // Renewal Options: surface from structured JSON when present
  if (abs.renewalOptions) {
    try {
      const opts = JSON.parse(abs.renewalOptions);
      const summary = typeof opts === "string"
        ? opts
        : Array.isArray(opts) && opts.length > 0
          ? JSON.stringify(opts)
          : null;
      if (summary && summary !== "null" && summary !== "[]") {
        out.push({
          leaseId: abs.leaseId,
          tenantName: abs.tenantName,
          section: "Renewal Options (system)",
          page: 0,
          text: `Tenant: ${tenant}. Renewal options: ${summary}.`,
          snippet: summary.slice(0, 80),
        });
      }
    } catch {
      // skip
    }
  }

  return out;
}

// Workstream D: per-lease unit enrichment (size + in-place rent/sqft) for the
// per-property expiration schedule. The `units` table carries both sizeSqft and
// rentPerSqft for bulk_load (Foundry) units; we join it to `leaseAbstracts`
// by property + suite. propertyAddress on the abstract equals properties.address;
// suite on the abstract equals units.suite. The key is `${address}::${suite}`.
type UnitEnrichment = { sizeSqft: number | null; rentPerSqft: number | null };

function enrichmentKey(propertyAddress: string | null, suite: string | null): string {
  return `${(propertyAddress ?? "").trim().toLowerCase()}::${(suite ?? "").trim().toLowerCase()}`;
}

// Per-property facts the NOI-lift market rent needs, mirroring A1's property
// route: the property name (Foundry special-case), submarket, the office
// flag, whether any unit has a private bathroom (together the built-out
// signal), and a sensible in-place fallback rent (the first unit's rent/sqft).
type PropertyInfo = {
  name: string | null;
  submarket: string | null;
  hasOffice: boolean;
  anyPrivateBathroom: boolean;
  firstRentPerSqft: number | null;
};

// Load a `${address}::${suite}` -> { sizeSqft, rentPerSqft } map plus an
// address -> PropertyInfo map, for the addresses referenced by an expiration
// schedule. One small query each; runs only when a per-property expiration
// query matches a property.
async function loadUnitEnrichment(propertyAddresses: string[]): Promise<{
  byKey: Map<string, UnitEnrichment>;
  infoByAddress: Map<string, PropertyInfo>;
}> {
  const byKey = new Map<string, UnitEnrichment>();
  const infoByAddress = new Map<string, PropertyInfo>();
  if (propertyAddresses.length === 0) return { byKey, infoByAddress };
  const rows = await db
    .select({
      name: schema.properties.name,
      address: schema.properties.address,
      submarket: schema.properties.submarket,
      hasOffice: schema.properties.hasOffice,
      suite: schema.units.suite,
      sizeSqft: schema.units.sizeSqft,
      rentPerSqft: schema.units.rentPerSqft,
      hasPrivateBathroom: schema.units.hasPrivateBathroom,
    })
    .from(schema.units)
    .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id));
  const wanted = new Set(propertyAddresses.map((a) => a.trim().toLowerCase()));
  for (const r of rows) {
    const addrNorm = (r.address ?? "").trim().toLowerCase();
    if (!wanted.has(addrNorm)) continue;
    const info = infoByAddress.get(addrNorm) ?? {
      name: r.name,
      submarket: r.submarket,
      hasOffice: !!r.hasOffice,
      anyPrivateBathroom: false,
      firstRentPerSqft: null as number | null,
    };
    if (r.hasPrivateBathroom === true) info.anyPrivateBathroom = true;
    if (info.firstRentPerSqft == null && r.rentPerSqft != null) info.firstRentPerSqft = r.rentPerSqft;
    infoByAddress.set(addrNorm, info);
    byKey.set(enrichmentKey(r.address, r.suite), {
      sizeSqft: r.sizeSqft,
      rentPerSqft: r.rentPerSqft,
    });
  }
  return { byKey, infoByAddress };
}

// Derive a lease's in-place annual rent/sqft. Prefer the linked unit's
// rentPerSqft; fall back to the first base-rent-schedule tier's
// annualRentPerSqft (L2 leases without a linked unit). Size has no schedule
// fallback, so it stays null when no unit is linked.
function inPlaceRentPsfForLease(
  unit: UnitEnrichment | undefined,
  baseRentSchedule: string | null,
): number | null {
  if (unit?.rentPerSqft != null) return unit.rentPerSqft;
  if (!baseRentSchedule) return null;
  try {
    const sched = JSON.parse(baseRentSchedule) as Array<{ annualRentPerSqft: number | null }>;
    if (Array.isArray(sched) && sched.length > 0 && sched[0].annualRentPerSqft != null) {
      return sched[0].annualRentPerSqft;
    }
  } catch {
    // malformed: no fallback
  }
  return null;
}

// Market rent for a property's NOI-lift calc. Mirrors A1's property route so the
// two demos agree on ANY property: the Foundry worked example uses
// FOUNDRY_UW; every other property derives its built-out signal
// (hasOffice AND any unit with a private bathroom) the same way A1 does and
// passes it to getUwAssumptions, so a built-out property picks the built-out
// band rather than the raw-warehouse band.
function marketRentForProperty(info: PropertyInfo | undefined): number {
  if (info?.name === "Foundry Business Center") return FOUNDRY_UW.marketRentPsf;
  const isBuiltOut = !!info?.hasOffice && (info?.anyPrivateBathroom ?? false);
  return getUwAssumptions(info?.submarket ?? "", {
    isBuiltOut,
    isExpansion: false,
    fallbackRentPsf: info?.firstRentPerSqft ?? 18,
  }).marketRentPsf;
}

export async function retrieveLeaseSections(
  query: string,
  opts: RetrievalOptions = {}
): Promise<LeaseSectionResult[]> {
  const k = opts.k ?? 8;
  const scopedLeaseId = opts.leaseId ?? null;
  const sqlite = openSqlite();

  let ftsRows: Array<{ lease_id: string; section: string; page: number; text: string; snippet: string; rank: number }> = [];
  try {
    const ftsQuery = buildFtsQuery(query);
    let sql =
      "SELECT lease_id, section, page, text, snippet(lease_sections_fts, 3, '<<', '>>', '...', 6) AS snippet, rank " +
      "FROM lease_sections_fts WHERE lease_sections_fts MATCH ?";
    const params: Array<string | number> = [ftsQuery];
    if (scopedLeaseId) {
      sql += " AND lease_id = ?";
      params.push(scopedLeaseId);
    }
    sql += " ORDER BY rank LIMIT ?";
    params.push(Math.max(40, k * 4));
    ftsRows = sqlite.prepare(sql).all(...params) as typeof ftsRows;
  } finally {
    sqlite.close();
  }

  // Rebalance: at most 2 FTS sections per lease so a single tenant doesn't
  // crowd out the rest. (Skipped when scoped, we want everything on the one
  // lease.)
  if (!scopedLeaseId) {
    const perLease = new Map<string, number>();
    const balanced: typeof ftsRows = [];
    for (const r of ftsRows) {
      const taken = perLease.get(r.lease_id) ?? 0;
      if (taken >= 2) continue;
      perLease.set(r.lease_id, taken + 1);
      balanced.push(r);
      if (balanced.length >= k * 2) break;
    }
    ftsRows = balanced;
  }

  // Pull abstracts once. Cheap query; small N. Used to (a) map leaseId →
  // tenant, (b) synthesize system sections, (c) feed expiration / NER side
  // paths.
  const absRows = await db
    .select({
      leaseId: schema.leaseAbstracts.leaseId,
      tenantName: schema.leaseAbstracts.tenantName,
      suite: schema.leaseAbstracts.suite,
      propertyAddress: schema.leaseAbstracts.propertyAddress,
      leaseStart: schema.leaseAbstracts.leaseStart,
      leaseEnd: schema.leaseAbstracts.leaseEnd,
      baseRentSchedule: schema.leaseAbstracts.baseRentSchedule,
      securityDeposit: schema.leaseAbstracts.securityDeposit,
      tiAllowance: schema.leaseAbstracts.tiAllowance,
      freeRentMonths: schema.leaseAbstracts.freeRentMonths,
      renewalOptions: schema.leaseAbstracts.renewalOptions,
      rawSections: schema.leaseAbstracts.rawSections,
    })
    .from(schema.leaseAbstracts);

  const abstractByLease = new Map<string, AbstractRow & { rawSections: string | null }>();
  const tenantByLease = new Map<string, string | null>();
  for (const a of absRows) {
    if (!a.leaseId) continue;
    abstractByLease.set(a.leaseId, {
      leaseId: a.leaseId,
      tenantName: a.tenantName,
      suite: a.suite,
      propertyAddress: a.propertyAddress,
      leaseStart: a.leaseStart,
      leaseEnd: a.leaseEnd,
      baseRentSchedule: a.baseRentSchedule,
      securityDeposit: a.securityDeposit,
      tiAllowance: a.tiAllowance,
      freeRentMonths: a.freeRentMonths,
      renewalOptions: a.renewalOptions,
      rawSections: a.rawSections,
    });
    tenantByLease.set(a.leaseId, a.tenantName);
  }

  // Decide which leases get system sections. Scoped → just that one. Otherwise
  // → every lease referenced by the FTS pool, so cross-lease questions still
  // have authoritative dates / rent to cite.
  const candidateLeaseIds = scopedLeaseId
    ? [scopedLeaseId]
    : Array.from(new Set(ftsRows.map((r) => r.lease_id)));

  const askingDates = mentionsDates(query);
  const askingRent = mentionsRent(query);
  const askingDeposit = mentionsDeposit(query);
  const askingExpiration = mentionsExpiration(query);
  const askingNer = mentionsNetEffectiveRent(query);
  const askingLoanDocs = mentionsLoanDocs(query);
  const askingRecovery = mentionsRecovery(query);

  // System sections (the fix). Always emitted for the scoped lease; otherwise
  // filtered to whatever the query is actually about, so we don't drown a
  // cross-lease question in irrelevant system rows.
  const systemAdds: LeaseSectionResult[] = [];
  for (const leaseId of candidateLeaseIds) {
    const abs = abstractByLease.get(leaseId);
    if (!abs) continue;
    const sections = buildSystemSectionsForLease(abs);
    for (const s of sections) {
      if (!scopedLeaseId) {
        if (s.section.startsWith("Lease Dates") && !(askingDates || askingExpiration)) continue;
        if (s.section.startsWith("Rent Schedule") && !(askingRent || askingNer)) continue;
        if (s.section.startsWith("Deposit") && !(askingDeposit || askingNer)) continue;
        if (s.section.startsWith("Renewal") && !askingExpiration) continue;
      }
      systemAdds.push(s);
    }
  }

  // C3-1b: named-tenant pin. When the UNSCOPED query names a tenant (e.g. the
  // "HVAC responsibility for ${tenant}" / "Lender consent and loan docs for
  // ${tenant}" chips), pin that tenant's OWN rawSections (page > 0, clickable)
  // at the FRONT of the pool, AHEAD of the per-lease rebalance and the final
  // k-slice. Without this, a single named lease is crowded out by the 22 bulk
  // leases (FTS + the 2-sections-per-lease cap + slice(0,k)) and the answer
  // cites OTHER tenants' clauses. rankLeasesInQuery resolves the chip to the
  // most distinctively-named tenant, so "HVAC ... for Copper Loop" pins
  // Copper Loop (not "Gulf Coast HVAC Solutions", matched only by the
  // incidental domain word "hvac").
  if (!scopedLeaseId) {
    const rankedNamed = rankLeasesInQuery(query, abstractByLease);
    const pinnedLeaseId = rankedNamed[0] ?? null;
    if (pinnedLeaseId) {
      const abs = abstractByLease.get(pinnedLeaseId);
      if (abs?.rawSections) {
        let pinSections: Array<{ section: string; page: number; text: string }> = [];
        try {
          pinSections = JSON.parse(abs.rawSections);
        } catch {
          pinSections = [];
        }
        // Prefer the sections relevant to the classified intent so the pin is
        // tight; if the intent matches no section, pin every section of the
        // named lease so the answer still belongs to the named tenant.
        const intentRe = buildPinSectionMatcher(query);
        const relevant = intentRe
          ? pinSections.filter((s) => intentRe.test(s.section))
          : [];
        const toPin = relevant.length > 0 ? relevant : pinSections;
        // unshift in reverse so the array order is preserved at the front.
        for (let i = toPin.length - 1; i >= 0; i--) {
          const p = toPin[i];
          systemAdds.unshift({
            leaseId: pinnedLeaseId,
            tenantName: abs.tenantName,
            section: p.section,
            page: p.page,
            text: p.text,
            snippet: "",
          });
        }
      }
    }
  }

  // Expiration side path retained: for cross-portfolio "what's expiring next
  // quarter" questions, surface every lease ending in the next 12 months even
  // if it wasn't in the FTS pool.
  if (askingExpiration && !scopedLeaseId) {
    const now = new Date();
    const horizon = new Date(now.getTime() + 365 * 86_400_000);
    const expiring = await db
      .select({
        leaseId: schema.leaseAbstracts.leaseId,
        tenantName: schema.leaseAbstracts.tenantName,
        leaseEnd: schema.leaseAbstracts.leaseEnd,
      })
      .from(schema.leaseAbstracts)
      .where(
        and(
          gte(schema.leaseAbstracts.leaseEnd, now),
          lte(schema.leaseAbstracts.leaseEnd, horizon),
        ),
      );
    for (const e of expiring) {
      if (!e.leaseId) continue;
      const endIso = e.leaseEnd ? e.leaseEnd.toISOString().slice(0, 10) : "unknown";
      systemAdds.push({
        leaseId: e.leaseId,
        tenantName: e.tenantName,
        section: "Lease Dates (system)",
        page: 0,
        text: `Tenant: ${e.tenantName ?? "Unknown"}. Lease end date: ${endIso}.`,
        snippet: `Lease ends ${endIso}.`,
      });
    }

    // D.1: per-property expiration schedule. When the query names a property,
    // group that property's leases into a single structured "Expiration
    // Schedule (system)" section so the LLM can fill the typed `schedule`
    // field. Unlike the next-12-months side path above, this lists EVERY lease
    // at the matched property regardless of horizon, because a property
    // expiration schedule is the full ladder, not just imminent expiries.
    const matchedProperties = matchPropertiesInQuery(query, abstractByLease);
    // Workstream D: load unit size + in-place rent/sqft (and submarket) for the
    // matched properties once, so each schedule line can carry the headline
    // rental items and the NOI-lift stat is computable.
    const { byKey: unitByKey, infoByAddress } =
      matchedProperties.length > 0
        ? await loadUnitEnrichment(matchedProperties)
        : { byKey: new Map<string, UnitEnrichment>(), infoByAddress: new Map<string, PropertyInfo>() };
    for (const propertyAddress of matchedProperties) {
      const propLeases = Array.from(abstractByLease.values())
        .filter((a) => a.propertyAddress === propertyAddress)
        .sort((a, b) => (a.leaseEnd?.getTime() ?? 0) - (b.leaseEnd?.getTime() ?? 0));
      if (propLeases.length === 0) continue;
      const today = new Date();
      // Per-lease enrichment: size + in-place rent/sqft from the linked unit,
      // with a baseRentSchedule fallback for rent when no unit is linked.
      const enriched = propLeases.map((a) => {
        const unit = unitByKey.get(enrichmentKey(a.propertyAddress, a.suite));
        const sizeSqft = unit?.sizeSqft ?? null;
        const rentPerSqft = inPlaceRentPsfForLease(unit, a.baseRentSchedule);
        return { a, sizeSqft, rentPerSqft };
      });
      const lines = enriched.map(({ a, sizeSqft, rentPerSqft }) => {
        const endIso = a.leaseEnd ? a.leaseEnd.toISOString().slice(0, 10) : "unknown";
        const days = a.leaseEnd
          ? Math.round((a.leaseEnd.getTime() - today.getTime()) / 86_400_000)
          : null;
        const suite = a.suite ? `Suite ${a.suite}` : "Suite n/a";
        const renewal = renewalSummary(a.renewalOptions);
        const size = sizeSqft != null ? `${sizeSqft.toLocaleString()} sqft` : "size n/a";
        const rent = rentPerSqft != null ? `$${rentPerSqft.toFixed(2)}/sqft in-place` : "rent/sqft n/a";
        return `${a.tenantName ?? "Unknown tenant"} | ${suite} | ${size} | ${rent} | lease ends ${endIso}${days != null ? ` (${days} days to expiry)` : ""} | renewal: ${renewal}`;
      });
      // Anchor the section on the first lease at the property so the citation
      // resolves to a real lease, and group every tenant into one text block.
      // unshift (not push): the grouped schedule is the single most relevant
      // section for a per-property expiration query, so it must lead and
      // survive the final slice(0, k) cutoff ahead of the per-lease next-12-
      // month rows added just above.
      const anchor = propLeases[0];
      systemAdds.unshift({
        leaseId: anchor.leaseId,
        tenantName: anchor.tenantName,
        section: "Expiration Schedule (system)",
        page: 0,
        text:
          `Per-property tenant expiration schedule for ${propertyAddress} ` +
          `(${propLeases.length} leases, sorted by lease end date; each line lists tenant, suite, unit size, in-place rent/sqft, lease end, and renewal):\n${lines.join("\n")}`,
        snippet: `${propLeases.length} leases at ${propertyAddress}`,
      });

      // Workstream D: anticipated annual NOI lift at rollover (market rent vs
      // in-place) across this property's leases. marketRentForProperty reuses
      // the same band A1 uses (including the built-out signal) so the two demos
      // agree. Injected as a single "NOI Lift (system)" line the LLM copies
      // into the analysis object.
      const propertyInfo = infoByAddress.get(propertyAddress.trim().toLowerCase());
      const marketRentPsf = marketRentForProperty(propertyInfo);
      const noiLift = noiLiftFromExpirations(
        enriched.map((e) => ({ inPlaceRentPsf: e.rentPerSqft, sizeSqft: e.sizeSqft })),
        marketRentPsf,
      );
      systemAdds.unshift({
        leaseId: anchor.leaseId,
        tenantName: anchor.tenantName,
        section: "NOI Lift (system)",
        page: 0,
        text:
          `NOI Lift (system): anticipated annual NOI lift at rollover ~$${noiLift.toLocaleString()} ` +
          `across ${propLeases.length} expiring leases (market rent vs in-place).`,
        snippet: `~$${noiLift.toLocaleString()} NOI lift across ${propLeases.length} leases`,
      });
    }
  }

  // D.2: loan-document / lender-consent side path. Surface the real "Lender
  // Consent and Loan Documents" rawSections (page > 0, so the citation is
  // clickable) for every lease whose tenant or address is referenced by the
  // query, or for the whole portfolio when no specific lease is named.
  if (askingLoanDocs && !scopedLeaseId) {
    const namedLeases = matchLeasesInQuery(query, abstractByLease);
    const targetLeaseIds = namedLeases.length > 0
      ? namedLeases
      : Array.from(abstractByLease.keys());
    for (const leaseId of targetLeaseIds) {
      const abs = abstractByLease.get(leaseId);
      if (!abs) continue;
      const sections: Array<{ section: string; page: number; text: string }> = abs.rawSections
        ? (() => {
            try { return JSON.parse(abs.rawSections!); } catch { return []; }
          })()
        : [];
      const picks = sections.filter((s) =>
        /lender|loan document|loan doc|mortgage|deed of trust|estoppel|snda|subordinat|non-disturbance|attornment|lender consent/i.test(
          s.section,
        ),
      );
      for (const p of picks) {
        systemAdds.push({
          leaseId,
          tenantName: tenantByLease.get(leaseId) ?? null,
          section: p.section,
          page: p.page,
          text: p.text,
          snippet: "",
        });
      }
    }
  }

  // Operating-expense recovery side path (Alex's 4-Jun ask). Surface the real
  // "Operating Expenses / Additional Rent" (and CAM) rawSections (page > 0, so
  // the citation is clickable) for every lease whose tenant or address is
  // referenced by the query, or for the whole portfolio when no specific lease
  // is named, so a recovery question is answerable with a citation. Mirrors the
  // loan-doc side path.
  if (askingRecovery && !scopedLeaseId) {
    const namedLeases = matchLeasesInQuery(query, abstractByLease);
    const targetLeaseIds = namedLeases.length > 0
      ? namedLeases
      : Array.from(abstractByLease.keys());
    for (const leaseId of targetLeaseIds) {
      const abs = abstractByLease.get(leaseId);
      if (!abs) continue;
      const sections: Array<{ section: string; page: number; text: string }> = abs.rawSections
        ? (() => {
            try { return JSON.parse(abs.rawSections!); } catch { return []; }
          })()
        : [];
      const picks = sections.filter((s) =>
        /operating expense|additional rent|\bcam\b|common area maintenance|recover|pass[- ]?through/i.test(
          s.section,
        ),
      );
      for (const p of picks) {
        systemAdds.push({
          leaseId,
          tenantName: tenantByLease.get(leaseId) ?? null,
          section: p.section,
          page: p.page,
          text: p.text,
          snippet: "",
        });
      }
    }
  }

  // NER side path retained: pull every lease's Free Rent + TI + Base Rent
  // rawSections so the LLM can compute net effective rent across the portfolio.
  if (askingNer && !scopedLeaseId) {
    for (const [leaseId, abs] of abstractByLease) {
      const sections: Array<{ section: string; page: number; text: string }> = abs.rawSections
        ? (() => {
            try { return JSON.parse(abs.rawSections!); } catch { return []; }
          })()
        : [];
      const picks = sections.filter((s) =>
        /free rent|tenant improvement|base rent|escalation/i.test(s.section),
      );
      for (const p of picks) {
        systemAdds.push({
          leaseId,
          tenantName: tenantByLease.get(leaseId) ?? null,
          section: p.section,
          page: p.page,
          text: p.text,
          snippet: "",
        });
      }
    }
  }

  // Merge: system sections lead (they're authoritative for the classified
  // intent), then FTS pool fills in domain detail (HVAC clause, use clause,
  // insurance language). Deduplicate by (leaseId, section).
  const merged: LeaseSectionResult[] = [];
  const seen = new Set<string>();
  for (const r of systemAdds) {
    const key = `${r.leaseId}::${r.section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  for (const r of ftsRows) {
    const key = `${r.lease_id}::${r.section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      leaseId: r.lease_id,
      tenantName: tenantByLease.get(r.lease_id) ?? null,
      section: r.section,
      page: r.page,
      text: r.text,
      snippet: r.snippet,
    });
  }
  return merged.slice(0, k);
}

// True when the query reads as an availability ("what is empty and rentable")
// question. The C3 route uses this to fire the units-aware availability side
// path and surface vacant shells as answer context.
export function queryIsAvailability(query: string): boolean {
  return mentionsAvailability(query);
}

// D.3: availability side path. Returns vacant units (units.tenantName IS NULL)
// joined to their property, optionally narrowed to the property named in the
// query. These are the A5-seeded vacant shells (Foundry) plus any other
// vacant portfolio units. The result shape is deliberately NOT a
// LeaseSectionResult so the caller can present it as a distinct availability
// block instead of mixing it into the citation list.
export async function retrieveAvailability(query: string): Promise<AvailableUnitResult[]> {
  const rows = await db
    .select({
      unitId: schema.units.id,
      propertyName: schema.properties.name,
      propertyAddress: schema.properties.address,
      suite: schema.units.suite,
      sizeSqft: schema.units.sizeSqft,
      leaseType: schema.units.leaseType,
    })
    .from(schema.units)
    .innerJoin(schema.properties, eq(schema.units.propertyId, schema.properties.id))
    .where(isNull(schema.units.tenantName));

  // If the query names a property, narrow to that property's vacant units so a
  // "what is empty at Foundry?" answer is not diluted by other vacancies.
  const q = normalizeForMatch(query);
  const named = rows.filter((r) => {
    if (!r.propertyName && !r.propertyAddress) return false;
    const tokens = [
      ...normalizeForMatch(r.propertyName ?? "").split(" "),
      ...normalizeForMatch(r.propertyAddress ?? "").split(" "),
    ].filter((t) => t.length >= 4 && !ADDRESS_STOPWORDS.has(t));
    return tokens.some((t) => q.includes(t));
  });
  const picked = named.length > 0 ? named : rows;

  return picked.map((r) => ({
    unitId: r.unitId,
    propertyName: r.propertyName,
    propertyAddress: r.propertyAddress,
    suite: r.suite,
    sizeSqft: r.sizeSqft,
    leaseType: r.leaseType,
    tenantName: null,
  }));
}

// C3-2: reconstruct a synthesized "(system)" section from a lease's structured
// columns so a citation to it resolves (instead of 404ing in the section
// route, which only finds real rawSections). Returns the same
// { section, page, text } shape the citation-detail panel renders, or null if
// the requested system section can't be reconstructed for this lease.
//
// Lease Dates / Rent Schedule / Deposit & Concessions / Renewal Options reuse
// the exact synthesis from buildSystemSectionsForLease, so the reconstructed
// text matches what was cited at retrieval time. Expiration Schedule (system)
// is a grouped per-property block at retrieval time; here we reconstruct the
// citing lease's own expiration line as a clean, resolvable fallback.
export function reconstructSystemSection(
  sectionName: string,
  abs: AbstractRow,
): { section: string; page: number; text: string } | null {
  const built = buildSystemSectionsForLease(abs);
  const match = built.find((s) => s.section === sectionName);
  if (match) {
    return { section: match.section, page: match.page, text: match.text };
  }

  // Expiration Schedule (system): the retrieval-time section groups every lease
  // at the property; reconstruct this lease's own expiration line so the
  // citation still resolves to authoritative content.
  if (/^Expiration Schedule \(system\)/i.test(sectionName)) {
    const tenant = abs.tenantName ?? "Unknown tenant";
    const where = [abs.suite ? `Suite ${abs.suite}` : null, abs.propertyAddress]
      .filter(Boolean)
      .join(", ");
    return {
      section: sectionName,
      page: 0,
      text:
        `Expiration detail for ${tenant}. ${where ? `Premises: ${where}. ` : ""}` +
        `Lease start date: ${fmtDate(abs.leaseStart)}. ` +
        `Lease end date: ${fmtDate(abs.leaseEnd)}. ` +
        `Renewal options: ${renewalSummary(abs.renewalOptions)}.`,
    };
  }

  return null;
}

// C3-2: reconstruct the "Available Unit (system)" section text from a unit row.
// An availability citation carries a units.id (not a leaseId), so it cannot be
// resolved against leaseAbstracts; the section route looks the unit up and
// passes its columns here. Mirrors the availabilityContext text built in the
// intelligence route so the panel shows the same summary.
export function reconstructAvailableUnitSection(unit: {
  suite: string | null;
  sizeSqft: number | null;
  leaseType: string | null;
  propertyName: string | null;
  propertyAddress: string | null;
}): { section: string; page: number; text: string } {
  const where = [unit.propertyName, unit.propertyAddress].filter(Boolean).join(", ");
  return {
    section: "Available Unit (system)",
    page: 0,
    text:
      `Available (vacant, rentable) unit. ${where ? `Property: ${where}. ` : ""}` +
      `Suite: ${unit.suite ?? "n/a"}. Size: ${unit.sizeSqft ?? "unknown"} square feet. ` +
      `Lease type: ${unit.leaseType ?? "n/a"}. This unit is empty and available to rent.`,
  };
}
