import { db, schema } from "@/db/client";
import { LeaseIntelligenceClient } from "@/components/c3/LeaseIntelligenceClient";
import { WorkflowChangePanel } from "@/components/shared/WorkflowChangePanel";
import { pickChipTenant, hvacChipString, lenderChipString } from "@/lib/c3-chips";
import { desc, eq } from "drizzle-orm";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const deepLinkLeaseIdRaw = params.leaseId;
  const deepLinkLeaseId = Array.isArray(deepLinkLeaseIdRaw)
    ? deepLinkLeaseIdRaw[0]
    : deepLinkLeaseIdRaw;

  // Build a leaseId -> tenant map so citation chips and the right-rail panel
  // can show real tenant names instead of truncated IDs. Cheap query, runs once
  // on each render of this server component.
  const abstractRows = await db
    .select({
      leaseId: schema.leaseAbstracts.leaseId,
      tenantName: schema.leaseAbstracts.tenantName,
      propertyAddress: schema.leaseAbstracts.propertyAddress,
      source: schema.leaseAbstracts.source,
      rawSections: schema.leaseAbstracts.rawSections,
    })
    .from(schema.leaseAbstracts)
    .orderBy(desc(schema.leaseAbstracts.extractedAt));
  const tenantMap: Record<string, string> = {};
  const addressMap: Record<string, string> = {};
  for (const r of abstractRows) {
    if (r.leaseId && r.tenantName) tenantMap[r.leaseId] = r.tenantName;
    if (r.leaseId && r.propertyAddress) addressMap[r.leaseId] = r.propertyAddress;
  }

  // If the user deep-linked from L2's "Ask C3 about this lease" button, surface
  // the lease's tenant + address in the initial chip set and auto-fire a query.
  let deepLinkInitialQuery: string | null = null;
  if (deepLinkLeaseId) {
    const rows = await db
      .select({
        tenantName: schema.leaseAbstracts.tenantName,
        propertyAddress: schema.leaseAbstracts.propertyAddress,
      })
      .from(schema.leaseAbstracts)
      .where(eq(schema.leaseAbstracts.leaseId, deepLinkLeaseId))
      .limit(1);
    if (rows[0]?.tenantName) {
      deepLinkInitialQuery = `Tell me about the ${rows[0].tenantName} lease: key terms, rent schedule, and renewal options.`;
    }
  }

  // C3-1: pick the chip tenant deterministically by SECTION PRESENCE, not by
  // abstractRows[0]. On a fresh seed abstractRows[0] is a `seed` lease ("Gulf
  // Coast HVAC Solutions") that has no Lender Consent section and gets crowded
  // out of the unscoped pool by the 22 bulk_load leases, so its chips answer
  // about the wrong tenant. pickChipTenant (shared with the regression test)
  // selects a `bulk_load` tenant whose lease carries BOTH a Maintenance/HVAC
  // section AND a Lender Consent section.
  const chipTenant = pickChipTenant(abstractRows);

  // When scoped to one lease, swap the portfolio-wide chips for lease-local
  // questions so the user has a direct path to "start/end dates" and "monthly
  // rent", the queries that used to return wrong sections.
  // The 8 portfolio chips below are FlexOps AI-curated example prompts grounded in
  // the client's stated use cases from discovery,
  // not a verbatim client list. They exercise every C3 retrieval path: HVAC,
  // per-property expiration schedule (structured), portfolio expirations, net
  // effective rent, lender consent / loan docs, renewals, free rent, and TI.
  const suggestedQueries = deepLinkLeaseId
    ? [
        "What are the lease start and end dates?",
        "What is the monthly rent?",
        "What is the security deposit?",
        "What are the renewal options?",
        "What is the TI allowance?",
        "Who is responsible for HVAC?",
      ]
    : [
        hvacChipString(chipTenant),
        "Per-property tenant expiration schedule for the Foundry property",
        "Leases expiring next quarter",
        "Compare net effective rents across the negotiated leases",
        lenderChipString(chipTenant),
        "Renewal options summary across the portfolio",
        "Which leases have free rent in year 1?",
        "Which leases have TI allowance over $10 per square foot?",
      ];

  const scopedTenant = deepLinkLeaseId ? tenantMap[deepLinkLeaseId] ?? null : null;

  return (
    <div className="p-6 flex flex-col h-full" style={{ height: "calc(100vh - 4rem)" }}>
      <header className="mb-4 shrink-0">
        <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">
          Lease Document Intelligence
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed max-w-2xl">
          {scopedTenant
            ? `Scoped to the ${scopedTenant} lease. Every answer cites a section of this lease.`
            : "Ask questions about the KFP lease portfolio. Every answer cites the source lease section."}
        </p>
      </header>
      <div className="mb-4 shrink-0">
        <WorkflowChangePanel
          withDemoLabel="With C3"
          today="Tenant emails the property manager about a lease question. The PM digs through the leasing folder, opens the PDF, scrolls for the right clause, copies the language, and replies. Multi-lease questions ('what's expiring next quarter?') trigger a one-off spreadsheet hand-build."
          withDemo="Natural-language chat over the entire lease library. Every answer cites the source lease section with page and exact quote, so the PM can verify before replying. Cross-lease questions (expirations, net-effective-rent comparisons, free-rent in year 1) return a comparison table without leaving the chat."
        />
      </div>
      <LeaseIntelligenceClient
        suggestedQueries={suggestedQueries}
        tenantMap={tenantMap}
        addressMap={addressMap}
        initialQuery={deepLinkInitialQuery}
        scopedLeaseId={deepLinkLeaseId ?? null}
      />
    </div>
  );
}
