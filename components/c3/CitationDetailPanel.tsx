"use client";

import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";

export type ActiveCitation = {
  leaseId: string;
  tenant: string;
  section: string;
  page: number;
  text: string;
  propertyAddress?: string | null;
  // C3-2: set when the section could not be resolved to a stored source, so the
  // panel shows the answer quote we already have and hides the "Open in L2"
  // deep-link (which would 404 for an unresolved or non-lease citation).
  unresolved?: boolean;
};

// Visual revamp 2026-05-27. THE wow moment of the demo. Section + page + tenant
// rendered in Plex Mono UPPERCASE above the quote; the quote itself is Plex
// Sans italic at 16px with a 3px charcoal left rule and generous left padding;
// the panel sits on --background-subtle so the quote breathes. Open-in-L2
// link tucked at the bottom-right.

export function CitationDetailPanel({ citation }: { citation: ActiveCitation | null }) {
  if (!citation) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 bg-background-subtle rounded-md border border-dashed border-border">
        <FileText className="size-8 text-foreground-faint" />
        <p className="text-sm text-foreground-muted">
          Click a citation in the chat to see the full lease excerpt.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col rounded-md border border-border bg-background-subtle overflow-hidden">
      {/* Header: UPPERCASE mono row: tenant · section · page */}
      <div className="px-5 pt-5 pb-3 border-b border-border bg-background">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground-muted leading-tight mb-2">
          <span className="text-foreground font-medium">{citation.tenant}</span>
          <span className="text-foreground-faint mx-1.5">·</span>
          <span>§ {citation.section}</span>
          <span className="text-foreground-faint mx-1.5">·</span>
          <span>P. {citation.page}</span>
        </p>
        {citation.propertyAddress ? (
          <p className="text-xs text-foreground-muted">{citation.propertyAddress}</p>
        ) : null}
      </div>

      {/* The quote: Plex Sans italic, charcoal left rule */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <blockquote className="border-l-[3px] border-foreground pl-5 text-[15.5px] leading-[1.6] italic text-foreground whitespace-pre-wrap">
          {citation.text}
        </blockquote>
      </div>

      {/* Footer: Open in L2 link. Hidden for availability citations (the id is
          a unitId, not a leaseId) and for unresolved citations, where the L2
          deep-link would 404. */}
      {!citation.unresolved && !/Available Unit \(system\)/i.test(citation.section) ? (
        <div className="px-5 py-3 border-t border-border bg-background flex justify-end">
          <Link
            href={`/lease-abstraction?leaseId=${citation.leaseId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
            title="Open in L2 Lease Abstraction"
          >
            Open in L2
            <ExternalLink className="size-3" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
