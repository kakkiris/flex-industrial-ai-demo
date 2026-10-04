"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { PushToYardiModal } from "@/components/l2/PushToYardiModal";
import { type ConfidenceLevel } from "@/lib/confidence";
import { toast } from "sonner";

type BaseRentStep = { from: string; to: string; monthlyRent: number | null; annualRentPerSqft: number | null };
type CamTerms = { type?: string | null };
type BillingContact = {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
};
type OperatingExpenseRecovery = {
  recoveryType: string | null;
  baseYear: number | null;
  recoveryMethod: string | null;
  proRataSharePct: number | null;
  expenseCategories: string[];
  capPct: number | null;
  reconciliationBasis: string | null;
  notes: string | null;
};

type AbstractData = {
  id: string;
  leaseId: string;
  tenantName: string | null;
  landlordName: string | null;
  propertyAddress: string | null;
  suite: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  baseRentSchedule: BaseRentStep[];
  tiAllowance: number | null;
  freeRentMonths: number | null;
  securityDeposit: number | null;
  camTerms: CamTerms | null;
  billingContact: BillingContact | null;
  estimatedRecoveryPsf: number | null;
  operatingExpenseRecovery: OperatingExpenseRecovery | null;
  useClause: string | null;
  extractionConfidence: Record<string, { level: ConfidenceLevel }>;
  extractionPath: "text" | "vision" | null;
  source: "seed" | "upload" | "bulk_load" | null;
  status: "awaiting_review" | "approved" | "pushed_to_yardi" | null;
  pushedToYardiAt: string | null;
};

type FieldConfig =
  | { kind: "text"; field: string; label: string }
  | { kind: "numeric"; field: string; label: string }
  | { kind: "readonly"; field: string; label: string; render?: (v: unknown) => string };

const FIELDS: FieldConfig[] = [
  { kind: "text", field: "tenantName", label: "Tenant" },
  { kind: "text", field: "landlordName", label: "Landlord" },
  { kind: "text", field: "propertyAddress", label: "Address" },
  { kind: "text", field: "suite", label: "Suite" },
  { kind: "readonly", field: "leaseStart", label: "Lease start", render: (v) => v ? new Date(v as string).toLocaleDateString() : "" },
  { kind: "readonly", field: "leaseEnd", label: "Lease end", render: (v) => v ? new Date(v as string).toLocaleDateString() : "" },
  { kind: "text", field: "useClause", label: "Use clause" },
  { kind: "numeric", field: "tiAllowance", label: "TI allowance ($/sqft)" },
  { kind: "numeric", field: "freeRentMonths", label: "Free rent (months)" },
  { kind: "numeric", field: "securityDeposit", label: "Security deposit ($)" },
];

function getConfidenceLevel(
  confidence: Record<string, { level: ConfidenceLevel }>,
  field: string
): ConfidenceLevel {
  return confidence[field]?.level ?? "high";
}

function FieldRow({
  config,
  value,
  confidence,
  onBlur,
}: {
  config: FieldConfig;
  value: unknown;
  confidence: ConfidenceLevel;
  onBlur: (field: string, val: string | number) => void;
}) {
  // Using useState with initial value only; parent must supply a stable key to remount when server value changes.
  const [local, setLocal] = useState(String(value ?? ""));

  if (config.kind === "readonly") {
    const display = config.render ? config.render(value) : String(value ?? "");
    return (
      <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center py-1">
        <div>
          <label className="text-xs text-muted-foreground block">{config.label}</label>
          <span className="text-sm">{display || "-"}</span>
        </div>
        <ConfidenceBadge level={confidence} />
      </div>
    );
  }

  if (config.kind === "text") {
    const isLong = config.field === "useClause" || config.field === "propertyAddress";
    return (
      <div className="py-1">
        <div className="flex items-center justify-between mb-0.5">
          <label className="text-xs text-muted-foreground">{config.label}</label>
          <ConfidenceBadge level={confidence} />
        </div>
        {isLong ? (
          <Textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onBlur(config.field, local)}
            className="text-sm min-h-12"
          />
        ) : (
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onBlur(config.field, local)}
            className="text-sm h-7"
          />
        )}
      </div>
    );
  }

  // numeric
  return (
    <div className="py-1">
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-xs text-muted-foreground">{config.label}</label>
        <ConfidenceBadge level={confidence} />
      </div>
      <Input
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const num = parseFloat(local);
          if (!isNaN(num)) onBlur(config.field, num);
        }}
        className="text-sm h-7"
      />
    </div>
  );
}

export function AbstractEditor({ leaseId }: { leaseId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["abstract", leaseId],
    queryFn: async () => {
      const res = await fetch(`/api/lease/${leaseId}/abstract`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "fetch failed");
      return json.data as AbstractData;
    },
  });

  async function handleBlur(field: string, val: string | number) {
    await fetch(`/api/lease/${leaseId}/abstract`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: val }),
    });
    await queryClient.invalidateQueries({ queryKey: ["abstract", leaseId] });
    await queryClient.invalidateQueries({ queryKey: ["leases"] });
  }

  async function handleBillingBlur(next: BillingContact) {
    await fetch(`/api/lease/${leaseId}/abstract`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ billingContact: next }),
    });
    await queryClient.invalidateQueries({ queryKey: ["abstract", leaseId] });
    await queryClient.invalidateQueries({ queryKey: ["leases"] });
  }

  async function handleRecoveryBlur(next: Partial<OperatingExpenseRecovery>) {
    await fetch(`/api/lease/${leaseId}/abstract`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operatingExpenseRecovery: next }),
    });
    await queryClient.invalidateQueries({ queryKey: ["abstract", leaseId] });
    await queryClient.invalidateQueries({ queryKey: ["leases"] });
  }

  async function handleApprove() {
    const res = await fetch(`/api/lease/${leaseId}/push-to-yardi`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Approve failed");
      return;
    }
    toast.success(`Pushed to Yardi at ${new Date(json.data.pushedToYardiAt).toLocaleTimeString()}`);
    await queryClient.invalidateQueries({ queryKey: ["abstract", leaseId] });
    await queryClient.invalidateQueries({ queryKey: ["leases"] });
  }

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
  if (error || !data) return <p className="text-sm text-rose-700">Failed to load abstract</p>;

  const confidence = data.extractionConfidence ?? {};
  const needsReviewFields = FIELDS.filter((f) => {
    const lvl = getConfidenceLevel(confidence, f.field);
    return lvl === "low" || lvl === "medium";
  });
  const reviewedFields = FIELDS.filter((f) => {
    const lvl = getConfidenceLevel(confidence, f.field);
    return lvl === "high";
  });

  // Recoveries (Alex 4-Jun ask). Routed into the Needs-review group when the
  // recovery confidence is low/medium, like the per-field rows.
  const recoveryConfidence = getConfidenceLevel(confidence, "operatingExpenseRecovery");
  const recoveryNeedsReview = recoveryConfidence === "low" || recoveryConfidence === "medium";
  const recoveryGroup = (
    <RecoveryGroup
      key={`recovery-${leaseId}`}
      value={data.operatingExpenseRecovery}
      confidence={recoveryConfidence}
      onSave={handleRecoveryBlur}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">
            Abstract
          </h2>
          {data.extractionPath ? (
            <span
              className={
                "font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-sm border " +
                (data.extractionPath === "vision"
                  ? "border-[var(--tone-violet-dot)]/30 bg-[var(--tone-violet-tint)] text-[var(--tone-violet-text)]"
                  : "border-[var(--tone-sky-dot)]/30 bg-[var(--tone-sky-tint)] text-[var(--tone-sky-text)]")
              }
              title={
                data.extractionPath === "vision"
                  ? "Vision path: Opus 4.7 native PDF (scanned source)"
                  : "Text path: unpdf + Sonnet 4.6 (text-native source)"
              }
            >
              {data.extractionPath} path
            </span>
          ) : null}
          {data.status === "awaiting_review" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-sm bg-[var(--tone-amber-tint)] text-[var(--tone-amber-text)] border border-[var(--tone-amber-dot)]/30">
              Awaiting review
            </span>
          ) : data.status === "pushed_to_yardi" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-sm bg-[var(--tone-emerald-tint)] text-[var(--tone-emerald-text)] border border-[var(--tone-emerald-dot)]/30" title={data.pushedToYardiAt ?? undefined}>
              Pushed to Yardi
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/lease-intelligence?leaseId=${leaseId}`}
            className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            Ask C3 about this lease →
          </Link>
          {data.status === "awaiting_review" ? (
            <Button size="sm" onClick={handleApprove}>
              Approve and push to Yardi
            </Button>
          ) : (
            <PushToYardiModal
              abstract={data}
              trigger={
                <Button variant="outline" size="sm">
                  Push to Yardi
                </Button>
              }
            />
          )}
        </div>
      </div>

      {(needsReviewFields.length > 0 || recoveryNeedsReview) && (
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
            Needs review
          </p>
          <div className="space-y-1 border-l-2 border-[var(--tone-amber-dot)] bg-[var(--tone-amber-tint)]/40 pl-3 pr-3 py-2 rounded-sm">
            {needsReviewFields.map((f) => (
              <FieldRow
                key={`${f.field}-${String((data as Record<string, unknown>)[f.field])}`}
                config={f}
                value={(data as Record<string, unknown>)[f.field]}
                confidence={getConfidenceLevel(confidence, f.field)}
                onBlur={handleBlur}
              />
            ))}
            {recoveryNeedsReview && recoveryGroup}
          </div>
        </div>
      )}

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
          Full abstract
        </p>
        <div className="space-y-1">
          {reviewedFields.map((f) => (
            <FieldRow
              key={`${f.field}-${String((data as Record<string, unknown>)[f.field])}`}
              config={f}
              value={(data as Record<string, unknown>)[f.field]}
              confidence={getConfidenceLevel(confidence, f.field)}
              onBlur={handleBlur}
            />
          ))}
        </div>
      </div>

      <BillingContactGroup
        key={`billing-${leaseId}`}
        value={data.billingContact}
        onSave={handleBillingBlur}
      />

      {!recoveryNeedsReview && recoveryGroup}

      {data.baseRentSchedule && data.baseRentSchedule.length > 0 && (
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
            Base rent schedule
          </p>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-background-subtle text-left border-b border-border">
                  <th className="px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-foreground-muted">From</th>
                  <th className="px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-foreground-muted">To</th>
                  <th className="px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-foreground-muted text-right">Monthly</th>
                  <th className="px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-foreground-muted text-right">$/sqft</th>
                </tr>
              </thead>
              <tbody>
                {data.baseRentSchedule.map((step, i) => (
                  <tr key={i} className="border-t border-border first:border-t-0">
                    <td className="px-2 py-1.5 font-mono tabular-nums text-foreground-muted">{step.from}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-foreground-muted">{step.to}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-right text-foreground">
                      {step.monthlyRent != null ? `$${step.monthlyRent.toLocaleString()}` : <span className="text-foreground-faint">-</span>}
                    </td>
                    <td className="px-2 py-1.5 font-mono tabular-nums text-right text-foreground">
                      {step.annualRentPerSqft != null ? step.annualRentPerSqft.toFixed(2) : <span className="text-foreground-faint">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Billing contact group: the Yardi CommContacts Role=Billing row (step 2 of the
// create-through-activate sequence). Every field is editable and nullable; an
// entity-only lease shows the company with empty person fields. Local state is
// committed on blur, mirroring the FieldRow edit pattern.
function BillingContactGroup({
  value,
  onSave,
}: {
  value: BillingContact | null;
  onSave: (next: BillingContact) => void;
}) {
  const [local, setLocal] = useState<BillingContact>({
    firstName: value?.firstName ?? null,
    lastName: value?.lastName ?? null,
    company: value?.company ?? null,
    phone: value?.phone ?? null,
    email: value?.email ?? null,
  });

  function update(field: keyof BillingContact, raw: string) {
    const next = { ...local, [field]: raw.trim() === "" ? null : raw };
    setLocal(next);
  }

  const fields: Array<{ field: keyof BillingContact; label: string }> = [
    { field: "firstName", label: "First name" },
    { field: "lastName", label: "Last name" },
    { field: "company", label: "Company" },
    { field: "phone", label: "Phone" },
    { field: "email", label: "Email" },
  ];

  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-2">
        Billing contact
        <span className="ml-2 normal-case tracking-normal text-foreground-faint">
          Yardi CommContacts, Role = Billing
        </span>
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-sm border border-border bg-background-subtle/40 px-3 py-2">
        {fields.map(({ field, label }) => (
          <div key={field} className="py-0.5">
            <label className="text-xs text-muted-foreground block mb-0.5">{label}</label>
            <Input
              value={local[field] ?? ""}
              onChange={(e) => update(field, e.target.value)}
              onBlur={() => onSave(local)}
              className="text-sm h-7"
              placeholder="-"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Recoveries group: the stated operating-expense recovery terms (Alex's 4-Jun
// ask, the most billing-critical Yardi field). Mirrors BillingContactGroup:
// every field editable, committed on blur via the PUT-on-blur path. The PUT
// route merges each partial onto the stored value, so editing one field does
// not clobber the rest. Routed into Needs review by the parent when the
// recovery confidence is low/medium.
const RECOVERY_TYPE_OPTIONS = [
  "nnn_full",
  "base_year_stop",
  "modified_gross",
  "gross_none",
  "custom",
] as const;
const RECOVERY_METHOD_OPTIONS = ["pro_rata_share", "fixed", "custom"] as const;
const RECONCILIATION_OPTIONS = ["calendar_year", "lease_year"] as const;

function RecoveryGroup({
  value,
  confidence,
  onSave,
}: {
  value: OperatingExpenseRecovery | null;
  confidence: ConfidenceLevel;
  onSave: (next: Partial<OperatingExpenseRecovery>) => void;
}) {
  const [local, setLocal] = useState<OperatingExpenseRecovery>({
    recoveryType: value?.recoveryType ?? null,
    baseYear: value?.baseYear ?? null,
    recoveryMethod: value?.recoveryMethod ?? null,
    proRataSharePct: value?.proRataSharePct ?? null,
    expenseCategories: value?.expenseCategories ?? [],
    capPct: value?.capPct ?? null,
    reconciliationBasis: value?.reconciliationBasis ?? null,
    notes: value?.notes ?? null,
  });

  function commit(next: OperatingExpenseRecovery) {
    setLocal(next);
    onSave(next);
  }

  function num(raw: string): number | null {
    if (raw.trim() === "") return null;
    const n = parseFloat(raw);
    return Number.isNaN(n) ? null : n;
  }

  const selectClass =
    "text-sm h-7 w-full rounded-sm border border-border bg-background px-2";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">
          Recoveries
          <span className="ml-2 normal-case tracking-normal text-foreground-faint">
            Operating-expense recovery (stated lease terms)
          </span>
        </p>
        <ConfidenceBadge level={confidence} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-sm border border-border bg-background-subtle/40 px-3 py-2">
        <div className="py-0.5">
          <label className="text-xs text-muted-foreground block mb-0.5">Recovery type</label>
          <select
            value={local.recoveryType ?? ""}
            onChange={(e) =>
              commit({ ...local, recoveryType: e.target.value === "" ? null : e.target.value })
            }
            className={selectClass}
          >
            <option value="">-</option>
            {RECOVERY_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="py-0.5">
          <label className="text-xs text-muted-foreground block mb-0.5">Base year</label>
          <Input
            type="number"
            value={local.baseYear ?? ""}
            onChange={(e) => setLocal({ ...local, baseYear: num(e.target.value) })}
            onBlur={() => onSave(local)}
            className="text-sm h-7"
            placeholder="-"
          />
        </div>
        <div className="py-0.5">
          <label className="text-xs text-muted-foreground block mb-0.5">Method</label>
          <select
            value={local.recoveryMethod ?? ""}
            onChange={(e) =>
              commit({ ...local, recoveryMethod: e.target.value === "" ? null : e.target.value })
            }
            className={selectClass}
          >
            <option value="">-</option>
            {RECOVERY_METHOD_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="py-0.5">
          <label className="text-xs text-muted-foreground block mb-0.5">Pro-rata share %</label>
          <Input
            type="number"
            value={local.proRataSharePct ?? ""}
            onChange={(e) => setLocal({ ...local, proRataSharePct: num(e.target.value) })}
            onBlur={() => onSave(local)}
            className="text-sm h-7"
            placeholder="-"
          />
        </div>
        <div className="py-0.5 col-span-2">
          <label className="text-xs text-muted-foreground block mb-0.5">Expense categories</label>
          <Input
            value={local.expenseCategories.join(", ")}
            onChange={(e) =>
              setLocal({
                ...local,
                expenseCategories: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s !== ""),
              })
            }
            onBlur={() => onSave(local)}
            className="text-sm h-7"
            placeholder="taxes, insurance, cam"
          />
        </div>
        <div className="py-0.5">
          <label className="text-xs text-muted-foreground block mb-0.5">Cap %</label>
          <Input
            type="number"
            value={local.capPct ?? ""}
            onChange={(e) => setLocal({ ...local, capPct: num(e.target.value) })}
            onBlur={() => onSave(local)}
            className="text-sm h-7"
            placeholder="-"
          />
        </div>
        <div className="py-0.5">
          <label className="text-xs text-muted-foreground block mb-0.5">Reconciliation basis</label>
          <select
            value={local.reconciliationBasis ?? ""}
            onChange={(e) =>
              commit({ ...local, reconciliationBasis: e.target.value === "" ? null : e.target.value })
            }
            className={selectClass}
          >
            <option value="">-</option>
            {RECONCILIATION_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="py-0.5 col-span-2">
          <label className="text-xs text-muted-foreground block mb-0.5">Notes</label>
          <Textarea
            value={local.notes ?? ""}
            onChange={(e) => setLocal({ ...local, notes: e.target.value.trim() === "" ? null : e.target.value })}
            onBlur={() => onSave(local)}
            className="text-sm min-h-12"
            placeholder="-"
          />
        </div>
      </div>
    </div>
  );
}
