import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Visual revamp 2026-05-27. Home grid uses a clean property-listing
// card pattern: rectangular cards on white canvas, near-black chrome, restraint
// on accent color. The demo ID chip is the one place outside the primary
// action button where brand indigo appears on this surface.
//
// 2026-06-06: A3 (Onboarding) declined outright on the 4-Jun validation call
// and removed. The tier grouping is gone; the home page now renders one flat
// grid of the five remaining demos (A1, C3, L2, A5, L1). Reframed cards still
// carry a short reframe note so declined-then-rebuilt items read as deliberate
// answers to objections, not silently dropped.

type DemoStatus = "BUILD NOW" | "BUILD PARTIAL";

type DemoCard = {
  id: "A1" | "A5" | "L1" | "L2" | "C3";
  title: string;
  perspective: string;
  trigger: string;
  status: DemoStatus;
  summary: string;
  href: string;
  reframeNote?: string;
  /** Short chip label shown under the title, e.g. "Two versions". */
  versionTag?: string;
  /** One-liner note about restructure history, shown under the title. */
  structureNote?: string;
};

const DEMOS: DemoCard[] = [
  {
    id: "A1",
    title: "Market Intelligence Dashboard",
    perspective: "Portfolio management serving Keystone acquiring underwriting.",
    trigger: "Acquisitions team underwriting a deal or evaluating a new submarket.",
    status: "BUILD PARTIAL",
    summary:
      "Ingests offering memoranda, extracts unit-level rent rolls, combines with internal portfolio data, returns comp queries by submarket, unit size, asset type, plus Bathroom and Office filters tied to Alex's 54-column rent roll structure.",
    href: "/market-intelligence",
  },
  {
    id: "C3",
    title: "Lease Document Intelligence",
    perspective: "Keystone leasing out (property managers, leasing team).",
    trigger: "Natural-language query against the abstracted lease database.",
    status: "BUILD NOW",
    summary:
      "Chat interface over the L2 lease abstracts. Answers questions like HVAC responsibility or upcoming expirations with citations to the source lease section.",
    href: "/lease-intelligence",
  },
  {
    id: "L2",
    title: "Automated Lease Abstraction",
    perspective: "Keystone leasing out.",
    trigger: "Signed lease PDF distributed for handoff.",
    status: "BUILD NOW",
    summary:
      "Dual-path PDF extractor: text-native form leases run via unpdf + Sonnet 4.6, scanned legacy leases via Opus 4.7 native PDF. Confidence-flags low-certainty fields. Push-to-Yardi output maps to the actual KFP rent roll columns.",
    href: "/lease-abstraction",
  },
  {
    id: "A5",
    title: "Acquisition Lease Bulk-Load",
    perspective: "Keystone acquiring.",
    trigger: "A deal closes and Keystone inherits the seller's in-place leases.",
    status: "BUILD PARTIAL",
    summary:
      "Ingests a closing rent roll and unit inventory, then emits the six linked Yardi commercial ETL tables in one bulk load. Occupied units fan out across all six tables; vacant units land as CommUnits plus CommSQFTs shells, available to rent. Replaces lease-by-lease hand entry. Live .xls ingest needs Yardi access.",
    href: "/acquisition-bulk-load",
    structureNote: "Added in the restructure (absorbs the retired L3).",
  },
  {
    id: "L1",
    title: "Leasing Qualification Backend",
    perspective: "Keystone leasing out.",
    trigger: "Prospect submits a leasing inquiry.",
    status: "BUILD NOW",
    summary:
      "Three-tier structured form qualifier captures business type, size, and location (Tier 1), timeline and lease term (Tier 2), and motivation plus loading needs (Tier 3). Never asks about budget. Posts a structured lead to the leasing inbox with per-field tier annotation and a qualification verdict.",
    href: "/chat-leasing",
    versionTag: "Two versions",
    reframeNote:
      "Both a structured-form backend and the conversational chatbot are available; Jordan warmed to the chat on 4-Jun (pending cost vs. traffic).",
  },
];

function StatusLabel({ status }: { status: DemoStatus }) {
  const tone =
    status === "BUILD NOW"
      ? "text-[var(--tone-emerald-text)]"
      : "text-[var(--tone-amber-text)]";
  const dot =
    status === "BUILD NOW"
      ? "bg-[var(--tone-emerald-dot)]"
      : "bg-[var(--tone-amber-dot)]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em]", tone)}>
      <span className={cn("inline-block size-1.5 rounded-full", dot)} />
      {status}
    </span>
  );
}

function DemoCardItem({ demo }: { demo: DemoCard }) {
  return (
    <div className="group/card flex flex-col rounded-md border border-border bg-card transition-colors hover:border-border-strong">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex h-5 items-center rounded-sm bg-primary px-1.5 font-mono text-[11px] font-medium text-primary-foreground tracking-tight">
            {demo.id}
          </span>
          <StatusLabel status={demo.status} />
        </div>
        <h3 className="text-[15px] font-semibold tracking-[-0.005em] leading-snug text-foreground mb-1.5">
          {demo.title}
        </h3>
        {demo.versionTag && (
          <span
            className="inline-flex h-4 items-center rounded-sm border border-border px-1.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-foreground-faint mb-1.5"
            title="Toggle our original proposal vs. the reframed version on the page"
          >
            {demo.versionTag}
          </span>
        )}
        {demo.structureNote && (
          <p className="text-[11.5px] text-foreground-faint italic mb-1.5 leading-snug">
            {demo.structureNote}
          </p>
        )}
        {demo.reframeNote && (
          <p className="text-[11.5px] text-foreground-faint italic mb-1.5 leading-snug">
            {demo.reframeNote}
          </p>
        )}
        <div className="space-y-0.5 text-xs">
          <p className="text-foreground-muted">{demo.perspective}</p>
          <p className="text-foreground-muted">
            <span className="font-medium text-foreground/80">Trigger: </span>
            {demo.trigger}
          </p>
        </div>
      </div>
      <div className="px-5 flex-1">
        <p className="text-[13px] text-foreground-muted leading-relaxed">
          {demo.summary}
        </p>
      </div>
      <div className="px-5 pt-4 pb-5">
        <Link
          href={demo.href}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
        >
          Open demo
          <ArrowRight className="size-3.5 transition-transform group-hover/card:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

export function StatusGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DEMOS.map((demo) => (
        <DemoCardItem key={demo.id} demo={demo} />
      ))}
    </div>
  );
}
