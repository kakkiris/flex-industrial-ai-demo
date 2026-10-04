"use client";

import { useState, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, Phone, Check, X, RotateCcw, Loader2, MapPin, Ruler } from "lucide-react";
import { toast } from "sonner";

type Verdict = "qualified" | "unqualified" | "manual_review";

interface Lead {
  id: string;
  source: string | null;
  // Tier 1
  businessType: string | null;
  businessName: string | null;
  spaceSizeSqft: number | null;
  location: string | null;
  // Tier 2
  timeline: string | null;
  leaseTermYears: number | null;
  // Tier 3
  existingLocations: string | null;
  motivation: string | null;
  loadingNeeds: string | null;
  callbackPreferred: boolean | null;
  // The labelled five-field submission block, stored at form-submit time.
  rawTranscript: string | null;
  tierMap: string | null;
  // Verdict
  verdict: Verdict | null;
  confidenceScore: number | null;
  reasoning: string | null;
  // Manual actions (added 2026-05-27)
  phone: string | null;
  manualVerdict: "approved" | "rejected" | null;
  scheduledVisitAt: string | number | null;
  actionedAt: string | number | null;
  actionedBy: string | null;
  // Matched vacant units (added 2026-05-31). JSON of AvailableUnit rows.
  matchedUnits: string | null;
  createdAt: string | number | null;
}

type MatchedUnit = {
  propertyName: string;
  submarket: string;
  suite: string;
  sizeSqft: number;
  leaseType: string;
};

function parseMatchedUnits(raw: string | null): MatchedUnit[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MatchedUnit[]) : [];
  } catch {
    return [];
  }
}

function VerdictBadge({
  verdict,
  manualVerdict,
  confidence,
}: {
  verdict: Verdict | null;
  manualVerdict: "approved" | "rejected" | null;
  confidence: number | null;
}) {
  if (manualVerdict === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-[var(--tone-emerald-dot)]" aria-hidden="true" />
        <span className="text-xs font-medium text-[var(--tone-emerald-text)]">Approved by team</span>
      </span>
    );
  }
  if (manualVerdict === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-[var(--tone-rose-dot)]" aria-hidden="true" />
        <span className="text-xs font-medium text-[var(--tone-rose-text)]">Rejected by team</span>
      </span>
    );
  }
  const v = verdict ?? "manual_review";
  const tone =
    v === "qualified"
      ? { dot: "bg-[var(--tone-emerald-dot)]", text: "text-[var(--tone-emerald-text)]", label: "Qualified" }
      : v === "unqualified"
        ? { dot: "bg-[var(--tone-rose-dot)]", text: "text-[var(--tone-rose-text)]", label: "Unqualified" }
        : { dot: "bg-[var(--tone-amber-dot)]", text: "text-[var(--tone-amber-text)]", label: "Manual review" };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span className={`text-xs font-medium ${tone.text}`}>{tone.label}</span>
      {confidence != null ? (
        <span className="font-mono tabular-nums text-[11px] text-foreground-muted ml-0.5">{confidence}</span>
      ) : null}
    </span>
  );
}

interface LeadsResponse {
  data: Lead[] | null;
  error: string | null;
}

function relativeTime(raw: string | number | null): string {
  if (!raw) return "unknown";
  const ts = typeof raw === "number" ? raw : new Date(raw).getTime();
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// The five fields the prospect submitted, derived from the structured lead row
// rather than a chat transcript. additionalCriteria is parsed out of the stored
// submission block (the open free-text field that the engine read for Tier 2/3
// signals) so the leasing team sees exactly what was entered.
type SubmissionField = { label: string; value: string };

function readAdditionalCriteria(raw: string | null): string | null {
  if (!raw) return null;
  const line = raw.split("\n").find((l) => l.startsWith("Additional criteria:"));
  if (!line) return null;
  const value = line.slice("Additional criteria:".length).trim();
  return value && value !== "(not provided)" ? value : null;
}

function buildSubmissionView(lead: Lead): SubmissionField[] {
  const additional = readAdditionalCriteria(lead.rawTranscript);
  return [
    { label: "Location", value: lead.location ?? "Not provided" },
    {
      label: "Square footage",
      value: lead.spaceSizeSqft ? `${lead.spaceSizeSqft.toLocaleString()} sqft` : "Not provided",
    },
    { label: "Business type", value: lead.businessType ?? "Not provided" },
    { label: "Business name", value: lead.businessName ?? "Not provided" },
    { label: "Additional criteria", value: additional ?? "Not provided" },
  ];
}

type EditableField =
  | { kind: "text"; field: keyof Lead; label: string }
  | { kind: "number"; field: keyof Lead; label: string };

const EDIT_FIELDS: EditableField[] = [
  { kind: "text", field: "businessType", label: "Business type" },
  { kind: "text", field: "businessName", label: "Business name" },
  { kind: "number", field: "spaceSizeSqft", label: "Space size (sqft)" },
  { kind: "text", field: "location", label: "Location" },
  { kind: "text", field: "timeline", label: "Timeline" },
  { kind: "number", field: "leaseTermYears", label: "Lease term (yrs)" },
  { kind: "text", field: "existingLocations", label: "Existing locations" },
  { kind: "text", field: "motivation", label: "Motivation" },
  { kind: "text", field: "loadingNeeds", label: "Loading needs" },
  { kind: "text", field: "phone", label: "Phone" },
];

function formatScheduledVisit(value: string | number | null): string {
  if (!value) return "";
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  if (isNaN(d.getTime())) return "";
  const tz = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tz);
  return local.toISOString().slice(0, 16);
}

function LeadDetail({
  lead,
  onUpdate,
}: {
  lead: Lead;
  onUpdate: (lead: Lead) => void;
}) {
  // LeadDetail is keyed by lead.id at the call site, so it remounts when the
  // user switches leads. That makes these initializers the source of truth and
  // removes the need for a state-reset effect (which the React lint rules flag
  // as a cascading-render risk).
  const [showPhone, setShowPhone] = useState(false);
  const [pendingScheduled, setPendingScheduled] = useState<string>(
    formatScheduledVisit(lead.scheduledVisitAt),
  );

  const patch = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error ?? "Update failed");
      return json.data as Lead;
    },
    onSuccess: (next) => {
      onUpdate(next);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
  });

  function applyEdit(field: string, value: string | number | boolean | null) {
    patch.mutate({ [field]: value });
  }

  function setManualVerdict(verdict: "approved" | "rejected" | null) {
    patch.mutate({ manualVerdict: verdict });
    if (verdict === "approved") toast.success("Marked approved");
    else if (verdict === "rejected") toast.success("Marked rejected");
    else toast.success("Reverted to AI verdict");
  }

  function scheduleVisit() {
    if (!pendingScheduled) {
      patch.mutate({ scheduledVisitAt: null });
      toast.success("Visit cleared");
      return;
    }
    const iso = new Date(pendingScheduled).toISOString();
    patch.mutate({ scheduledVisitAt: iso });
    toast.success("Visit scheduled");
  }

  const phone = lead.phone;
  const hasPhone = Boolean(phone);

  return (
    <div className="px-4 pb-8 space-y-5 text-sm">
      {/* Verdict + override row */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <VerdictBadge
            verdict={lead.verdict}
            manualVerdict={lead.manualVerdict}
            confidence={lead.confidenceScore}
          />
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={lead.manualVerdict === "approved" ? "default" : "outline"}
              onClick={() => setManualVerdict("approved")}
              disabled={patch.isPending}
              title="Override AI verdict, mark approved"
            >
              <Check className="mr-1 size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant={lead.manualVerdict === "rejected" ? "default" : "outline"}
              onClick={() => setManualVerdict("rejected")}
              disabled={patch.isPending}
              title="Override AI verdict, mark rejected"
            >
              <X className="mr-1 size-3.5" />
              Reject
            </Button>
            {lead.manualVerdict ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setManualVerdict(null)}
                disabled={patch.isPending}
                title="Clear override; defer back to AI verdict"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        {lead.reasoning ? (
          <blockquote className="border-l-[3px] border-foreground pl-3.5 py-1 text-[13px] italic leading-relaxed text-foreground">
            {lead.reasoning}
          </blockquote>
        ) : null}
      </div>

      {/* Schedule visit + call back */}
      <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background-subtle p-3">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-1.5">
            Schedule visit
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={pendingScheduled}
              onChange={(e) => setPendingScheduled(e.target.value)}
              className="text-sm h-8 max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={scheduleVisit} disabled={patch.isPending}>
              <CalendarClock className="mr-1 size-3.5" />
              {pendingScheduled ? "Save" : "Clear"}
            </Button>
          </div>
          {lead.scheduledVisitAt ? (
            <p className="text-[11px] text-foreground-muted mt-1.5">
              Currently scheduled for{" "}
              <span className="text-foreground">
                {new Date(lead.scheduledVisitAt).toLocaleString()}
              </span>
            </p>
          ) : null}
        </div>
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-1.5">
            Call back
          </p>
          {hasPhone ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPhone(true)}
                disabled={showPhone}
              >
                <Phone className="mr-1 size-3.5" />
                {showPhone ? "Calling…" : "Call back now"}
              </Button>
              {showPhone ? (
                <a
                  href={`tel:${phone}`}
                  className="font-mono tabular-nums text-sm text-foreground underline underline-offset-2"
                >
                  {phone}
                </a>
              ) : (
                <span className="text-[11px] text-foreground-muted">Phone hidden until needed</span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-foreground-muted italic">
              No phone captured during the qualifier. Ask the prospect to share one on follow-up.
            </p>
          )}
        </div>
      </div>

      {/* Inline field edits */}
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
          Edit captured fields
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {EDIT_FIELDS.map((cfg) => (
            <FieldRow
              key={`${cfg.field}-${String(lead[cfg.field] ?? "")}`}
              cfg={cfg}
              value={lead[cfg.field]}
              onCommit={(v) => applyEdit(String(cfg.field), v)}
              disabled={patch.isPending}
            />
          ))}
        </div>
      </div>

      {/* Submission view */}
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
          Form submission
        </p>
        <dl className="rounded-md border border-border bg-background-subtle divide-y divide-border">
          {buildSubmissionView(lead).map((field) => (
            <div key={field.label} className="grid grid-cols-[140px_1fr] gap-x-3 px-3 py-2">
              <dt className="text-xs text-foreground-muted">{field.label}</dt>
              <dd
                className={`text-[13px] leading-relaxed ${
                  field.value === "Not provided" ? "text-foreground-faint italic" : "text-foreground"
                }`}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Matched units */}
      <MatchedUnitsPanel raw={lead.matchedUnits} />

      {patch.isPending ? (
        <p className="text-[11px] text-foreground-muted inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </p>
      ) : null}
    </div>
  );
}

function FieldRow({
  cfg,
  value,
  onCommit,
  disabled,
}: {
  cfg: EditableField;
  value: unknown;
  onCommit: (v: string | number | null) => void;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(
    value == null ? "" : String(value),
  );
  function commit() {
    if (cfg.kind === "number") {
      if (local === "") return onCommit(null);
      const n = Number(local);
      if (!Number.isFinite(n)) return;
      onCommit(n);
    } else {
      onCommit(local === "" ? null : local);
    }
  }
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3 items-center">
      <label className="text-xs text-foreground-muted">{cfg.label}</label>
      <Input
        type={cfg.kind === "number" ? "number" : "text"}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        disabled={disabled}
        className="text-sm h-8"
      />
    </div>
  );
}

// Renders the vacant units the matcher attached to the lead at submit time. The
// matcher ranks on submarket + size band (rent-independent), so empty shells
// with no in-place rent still surface here.
function MatchedUnitsPanel({ raw }: { raw: string | null }) {
  const units = parseMatchedUnits(raw);
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
        Matched available units
      </p>
      {units.length === 0 ? (
        <p className="text-[11px] text-foreground-muted italic">
          No vacant units matched the stated need at submit time. The leasing team can still follow up as new space comes available.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {units.map((u, i) => (
            <li
              key={`${u.suite}-${i}`}
              className="rounded-md border border-border bg-background-subtle px-3 py-2"
            >
              <p className="text-[13px] font-medium text-foreground">
                {u.propertyName}
                <span className="text-foreground-muted font-normal"> : Suite {u.suite}</span>
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-foreground-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden="true" />
                  {u.submarket}
                </span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <Ruler className="size-3" aria-hidden="true" />
                  {u.sizeSqft.toLocaleString()} sqft
                </span>
                <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono uppercase tracking-[0.04em]">
                  {u.leaseType}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeadInbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<LeadsResponse>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<LeadsResponse>;
    },
  });

  const leads = data?.data ?? [];
  const selected = leads.find((l) => l.id === selectedId) ?? null;

  function handleUpdate(next: Lead) {
    queryClient.setQueryData<LeadsResponse>(["leads"], (prev) => {
      if (!prev?.data) return prev;
      return {
        ...prev,
        data: prev.data.map((l) => (l.id === next.id ? next : l)),
      };
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Leads Inbox</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="p-4 text-sm text-destructive">
              Failed to load leads. Please refresh.
            </p>
          ) : leads.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No leads yet. Submit the Inquiry Form tab to qualify a prospect.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Sqft</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const businessLabel = [lead.businessName, lead.businessType].filter(Boolean).join(" / ") || "-";
                  const statusBits: string[] = [];
                  if (lead.scheduledVisitAt) statusBits.push(`Visit ${new Date(lead.scheduledVisitAt).toLocaleDateString()}`);
                  if (lead.callbackPreferred) statusBits.push("Callback");
                  if (lead.actionedAt) statusBits.push(`Edited ${relativeTime(lead.actionedAt)}`);
                  return (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(lead.id)}
                    >
                      <TableCell>
                        <VerdictBadge
                          verdict={lead.verdict}
                          manualVerdict={lead.manualVerdict}
                          confidence={lead.confidenceScore}
                        />
                      </TableCell>
                      <TableCell className="text-foreground">{businessLabel}</TableCell>
                      <TableCell className="font-mono tabular-nums text-foreground">
                        {lead.spaceSizeSqft ? lead.spaceSizeSqft.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-foreground-muted">{lead.location ?? "-"}</TableCell>
                      <TableCell className="text-[11px] text-foreground-muted">
                        {statusBits.length > 0 ? (
                          <span className="space-x-1.5">
                            {statusBits.map((s, i) => (
                              <Fragment key={i}>
                                <span className="rounded-sm border border-border bg-background-subtle px-1.5 py-0.5 font-mono uppercase tracking-[0.04em]">
                                  {s}
                                </span>
                              </Fragment>
                            ))}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-xs italic text-foreground-muted max-w-[280px] truncate" title={lead.reasoning ?? ""}>
                        {lead.reasoning ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-foreground-faint text-[11px]">
                        {relativeTime(lead.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle>Lead Detail</SheetTitle>
            <SheetDescription>
              {[selected?.businessName, selected?.businessType].filter(Boolean).join(" / ") || "Unknown business"}
              {" : "}
              {selected?.location ?? "Location unknown"}
              {" : "}
              {relativeTime(selected?.createdAt ?? null)}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <LeadDetail key={selected.id} lead={selected} onUpdate={handleUpdate} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
