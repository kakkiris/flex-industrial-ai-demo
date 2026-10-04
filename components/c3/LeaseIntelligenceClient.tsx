"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { CitationDetailPanel, type ActiveCitation } from "./CitationDetailPanel";

type Citation = {
  leaseId: string;
  section: string;
  page: number;
  quote: string;
};

type AnswerTable = {
  columns: string[];
  rows: string[][];
};

// D.1: a structured per-property expiration schedule row. Rendered as its own
// block, distinct from the freeform comparison `table`. Workstream D adds
// sizeSqft + rentPerSqft so the schedule carries the headline rental items on
// first look.
type ScheduleRow = {
  propertyAddress: string;
  tenant: string;
  leaseEnd: string;
  suite?: string | null;
  daysToExpiry?: number | null;
  renewalOption?: string | null;
  sizeSqft?: number | null;
  rentPerSqft?: number | null;
};

// Workstream D: the anticipated-NOI-lift layer for a per-property expiration
// answer. Rendered as a headline stat above the schedule.
type AnswerAnalysis = {
  noiLiftAnnual: number;
  expiringCount: number;
  basis: string;
};

type AssistantMessage = {
  role: "assistant";
  answer: string;
  citations: Citation[];
  table: AnswerTable | null;
  schedule: ScheduleRow[] | null;
  analysis: AnswerAnalysis | null;
  responseTimeMs: number;
  tenantMap: Record<string, string>;
};

type UserMessage = {
  role: "user";
  content: string;
};

type Message = UserMessage | AssistantMessage;

type Props = {
  suggestedQueries: string[];
  tenantMap?: Record<string, string>;
  addressMap?: Record<string, string>;
  initialQuery?: string | null;
  // When set, every query is scoped to this lease, the deep-link from L2's
  // "Ask C3 about this lease" button. Without scoping, FTS used to pick any
  // section matching a token (e.g. "monthly" hitting Insurance) instead of
  // the lease's actual rent schedule.
  scopedLeaseId?: string | null;
};

export function LeaseIntelligenceClient({
  suggestedQueries,
  tenantMap: tenantMapProp,
  addressMap,
  initialQuery,
  scopedLeaseId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | null>(null);
  const [fetchingSection, setFetchingSection] = useState<string | null>(null);
  const [autoFired, setAutoFired] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Deep link from L2's "Ask C3 about this lease" button auto-fires a query
  // once. Run during render (not in an effect) so the lint rule against
  // setState-in-effect is satisfied. Idempotent via `autoFired`.
  if (initialQuery && !autoFired && !loading) {
    setAutoFired(true);
    void handleSubmit(initialQuery);
  }

  async function handleCitationClick(citation: Citation, tenantName: string) {
    const key = `${citation.leaseId}::${citation.section}`;
    if (fetchingSection === key) return;
    setFetchingSection(key);
    try {
      const res = await fetch(
        `/api/lease/${encodeURIComponent(citation.leaseId)}/section/${encodeURIComponent(citation.section)}`
      );
      const json = (await res.json()) as {
        data: { section: string; page: number; text: string } | null;
        error: string | null;
      };
      if (json.data) {
        setActiveCitation({
          leaseId: citation.leaseId,
          tenant: tenantName,
          section: json.data.section,
          page: json.data.page,
          text: json.data.text,
          propertyAddress: addressMap?.[citation.leaseId] ?? null,
        });
      } else {
        // C3-2: the section did not resolve. Surface the source quote we already
        // have from the answer so the click is never a silent dead end. Mark it
        // unresolved so the panel hides the "Open in L2" deep-link (which would
        // 404 for a system / availability citation).
        setActiveCitation({
          leaseId: citation.leaseId,
          tenant: tenantName,
          section: citation.section,
          page: citation.page,
          text: citation.quote,
          propertyAddress: addressMap?.[citation.leaseId] ?? null,
          unresolved: true,
        });
      }
    } catch {
      // non-fatal: panel stays at previous state
    } finally {
      setFetchingSection(null);
    }
  }

  async function handleSubmit(query: string) {
    const text = query.trim();
    if (!text || loading) return;

    const userMsg: UserMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/lease/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, leaseId: scopedLeaseId ?? null }),
      });
      const json = (await res.json()) as {
        data: {
          answer: string;
          citations: Citation[];
          table: AnswerTable | null;
          schedule?: ScheduleRow[] | null;
          analysis?: AnswerAnalysis | null;
          responseTimeMs: number;
        } | null;
        error: string | null;
      };

      if (!json.data) {
        const errMsg: AssistantMessage = {
          role: "assistant",
          answer: json.error ?? "An error occurred. Please try again.",
          citations: [],
          table: null,
          schedule: null,
          analysis: null,
          responseTimeMs: 0,
          tenantMap: {},
        };
        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      // Prefer the server-provided tenant map (real names from leaseAbstracts);
      // fall back to a shortened leaseId for any citation that wasn't seeded.
      const tenantMap: Record<string, string> = { ...(tenantMapProp ?? {}) };
      json.data.citations.forEach((c) => {
        if (!tenantMap[c.leaseId]) {
          tenantMap[c.leaseId] = c.leaseId.replace(/^lease_/, "").slice(0, 8);
        }
      });

      const assistantMsg: AssistantMessage = {
        role: "assistant",
        answer: json.data.answer,
        citations: json.data.citations,
        table: json.data.table,
        schedule: json.data.schedule ?? null,
        analysis: json.data.analysis ?? null,
        responseTimeMs: json.data.responseTimeMs,
        tenantMap,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-load first citation into detail panel
      if (json.data.citations.length > 0) {
        const first = json.data.citations[0];
        void handleCitationClick(first, tenantMap[first.leaseId] ?? first.leaseId);
      }
    } catch {
      const errMsg: AssistantMessage = {
        role: "assistant",
        answer: "Network error. Please try again.",
        citations: [],
        table: null,
        schedule: null,
        analysis: null,
        responseTimeMs: 0,
        tenantMap: {},
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(input);
    }
  }

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      {/* Left pane: chat (60%) */}
      <div className="flex flex-col flex-[3] min-h-0 gap-3">
        {/* Suggested query chips: single tone, no brand color */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {suggestedQueries.map((q) => (
            <button
              key={q}
              onClick={() => void handleSubmit(q)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-sm border border-border bg-background text-foreground-muted hover:bg-foreground/[0.04] hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Message list */}
        <Card className="flex-1 min-h-0">
          <CardContent className="p-3 h-full flex flex-col">
            <ScrollArea className="flex-1 min-h-0 pr-2">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  Ask a question to get started.
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {messages.map((msg, i) => (
                    <div key={i}>
                      {msg.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-md rounded-br-sm px-3 py-2 text-sm bg-foreground text-background">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="max-w-[90%] space-y-2">
                            <div className="rounded-md rounded-bl-sm px-3 py-2.5 text-sm bg-background-subtle border border-border">
                              <p className="leading-relaxed">{msg.answer}</p>

                              {msg.table && (
                                <div className="mt-3 overflow-x-auto">
                                  <table className="text-xs w-full border-collapse">
                                    <thead>
                                      <tr>
                                        {msg.table.columns.map((col, ci) => (
                                          <th
                                            key={ci}
                                            className="border border-border px-2 py-1 text-left font-semibold bg-background"
                                          >
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msg.table.rows.map((row, ri) => (
                                        <tr key={ri}>
                                          {row.map((cell, ci) => (
                                            <td
                                              key={ci}
                                              className="border border-border px-2 py-1"
                                            >
                                              {cell}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Workstream D: anticipated-NOI-lift headline
                                  stat for a per-property expiration answer.
                                  Figures in Plex Mono per the design system. */}
                              {msg.analysis && (
                                <div className="mt-3 rounded-sm border border-border bg-background px-3 py-2">
                                  <p className="text-sm text-foreground">
                                    Anticipated NOI lift at rollover:{" "}
                                    <span className="font-mono tabular-nums font-medium">
                                      ~${msg.analysis.noiLiftAnnual.toLocaleString()}/yr
                                    </span>{" "}
                                    across{" "}
                                    <span className="font-mono tabular-nums font-medium">
                                      {msg.analysis.expiringCount}
                                    </span>{" "}
                                    expiring leases
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {msg.analysis.basis}
                                  </p>
                                </div>
                              )}

                              {msg.schedule && msg.schedule.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[11px] font-medium text-foreground-muted mb-1.5 uppercase tracking-wide">
                                    Tenant expiration schedule
                                  </p>
                                  <div className="overflow-x-auto">
                                    <table className="text-xs w-full border-collapse">
                                      <thead>
                                        <tr>
                                          {["Property", "Tenant", "Suite", "Size", "Rent/SF", "Lease end", "Days to expiry", "Renewal"].map(
                                            (col) => (
                                              <th
                                                key={col}
                                                className="border border-border px-2 py-1 text-left font-semibold bg-background"
                                              >
                                                {col}
                                              </th>
                                            ),
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {msg.schedule.map((row, ri) => (
                                          <tr key={ri}>
                                            <td className="border border-border px-2 py-1">
                                              {row.propertyAddress}
                                            </td>
                                            <td className="border border-border px-2 py-1">{row.tenant}</td>
                                            <td className="border border-border px-2 py-1">
                                              {row.suite ?? "n/a"}
                                            </td>
                                            <td className="border border-border px-2 py-1 font-mono tabular-nums">
                                              {row.sizeSqft != null ? row.sizeSqft.toLocaleString() : "-"}
                                            </td>
                                            <td className="border border-border px-2 py-1 font-mono tabular-nums">
                                              {row.rentPerSqft != null ? `$${row.rentPerSqft.toFixed(2)}` : "-"}
                                            </td>
                                            <td className="border border-border px-2 py-1 font-mono tabular-nums">
                                              {row.leaseEnd}
                                            </td>
                                            <td className="border border-border px-2 py-1 font-mono tabular-nums">
                                              {row.daysToExpiry ?? "n/a"}
                                            </td>
                                            <td className="border border-border px-2 py-1">
                                              {row.renewalOption ?? "None on record"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {msg.citations.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-border/60">
                                  {msg.citations.map((c, ci) => {
                                    const chipKey = `${c.leaseId}::${c.section}`;
                                    const isActive =
                                      activeCitation?.leaseId === c.leaseId &&
                                      activeCitation?.section === c.section;
                                    const isFetching = fetchingSection === chipKey;
                                    return (
                                      <button
                                        key={ci}
                                        onClick={() =>
                                          void handleCitationClick(
                                            c,
                                            msg.tenantMap[c.leaseId] ?? c.leaseId
                                          )
                                        }
                                        disabled={isFetching}
                                        className={[
                                          "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border transition-colors",
                                          isActive
                                            ? "bg-foreground/[0.08] border-foreground/40 text-foreground"
                                            : "bg-background border-border text-foreground-muted hover:bg-foreground/[0.04] hover:text-foreground",
                                          isFetching ? "opacity-60 cursor-wait" : "cursor-pointer",
                                        ].join(" ")}
                                      >
                                        {isFetching && (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        )}
                                        <span className="font-mono">{msg.tenantMap[c.leaseId] ?? c.leaseId}</span>
                                        <span className="text-foreground-faint">·</span>
                                        <span className="truncate max-w-[160px]">{c.section}</span>
                                        <span className="text-foreground-faint">·</span>
                                        <span className="font-mono tabular-nums">p{c.page}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {msg.responseTimeMs > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-1.5">
                                  {(msg.responseTimeMs / 1000).toFixed(1)}s
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-md rounded-bl-sm px-3 py-2.5 bg-background-subtle border border-border">
                        <span className="inline-flex gap-1 items-center">
                          <span className="size-1.5 bg-foreground-faint rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="size-1.5 bg-foreground-faint rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="size-1.5 bg-foreground-faint rounded-full animate-bounce [animation-delay:300ms]" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input row */}
            <div className="flex gap-2 mt-3 shrink-0">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask about lease terms, responsibilities, expiry dates..."
                className="flex-1 text-sm"
              />
              <Button
                onClick={() => void handleSubmit(input)}
                disabled={loading || !input.trim()}
                size="icon"
                className="shrink-0"
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right pane: citation detail (40%), the wow moment, sized to breathe */}
      <div className="flex flex-col flex-[2] min-h-0">
        <CitationDetailPanel citation={activeCitation} />
      </div>
    </div>
  );
}
