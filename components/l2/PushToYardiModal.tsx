"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type RentStep = {
  from?: string | null;
  to?: string | null;
  monthlyRent?: number | null;
  annualRentPerSqft?: number | null;
};

type BillingContact = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
};

type OperatingExpenseRecovery = {
  recoveryType?: string | null;
  baseYear?: number | null;
  recoveryMethod?: string | null;
  proRataSharePct?: number | null;
  expenseCategories?: string[] | null;
  capPct?: number | null;
  reconciliationBasis?: string | null;
  notes?: string | null;
};

type AbstractLike = {
  tenantName?: string | null;
  suite?: string | null;
  propertyAddress?: string | null;
  leaseStart?: string | null;
  leaseEnd?: string | null;
  securityDeposit?: number | null;
  camTerms?: { type?: string | null } | null;
  baseRentSchedule?: RentStep[] | null;
  billingContact?: BillingContact | null;
  estimatedRecoveryPsf?: number | null;
  operatingExpenseRecovery?: OperatingExpenseRecovery | null;
  status?: "awaiting_review" | "approved" | "pushed_to_yardi" | null;
  // Unit size is not always carried on the abstract; passed in via props when known.
};

type PushArgs = {
  abstract: AbstractLike;
  unitSizeSqft?: number | null;        // For Annual Rent PSF computation when not in abstract
  proportionateShareRsf?: number | null; // % of RSF; not always available, surfaced as "-" if missing
  trigger: React.ReactNode;
};

// One paste-ready line: a label and a value, optionally indented under a step.
type OutputLine = { label: string; value: string };
// One labeled section matching a Yardi entity / step.
type OutputSection = { heading: string; entity: string; lines: OutputLine[] };

function toIsoDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function money(n: number | null | undefined): string {
  return n != null ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-";
}

// Build the five-step Yardi entity sections from the abstract. The output now
// matches the create-through-activate sequence the modal narrates: one section
// per Yardi entity, the full rent schedule (every escalation step), and the
// EstUtil recoveries line for modified-gross leases.
function buildSections(args: PushArgs): OutputSection[] {
  const { abstract, unitSizeSqft, proportionateShareRsf } = args;
  const schedule = abstract.baseRentSchedule ?? [];
  const leaseType = abstract.camTerms?.type ?? null;
  const isMg = leaseType === "MG";

  // (1) CommLeases: create the lease record.
  const lease: OutputSection = {
    heading: "1. Create lease",
    entity: "CommLeases",
    lines: [
      { label: "Tenant legal name", value: abstract.tenantName ?? "-" },
      { label: "Lease type", value: leaseType ?? "-" },
      { label: "Lease start", value: toIsoDate(abstract.leaseStart) || "-" },
      { label: "Lease end", value: toIsoDate(abstract.leaseEnd) || "-" },
      { label: "Move-in date", value: toIsoDate(abstract.leaseStart) || "-" },
      { label: "Security deposit", value: money(abstract.securityDeposit) },
    ],
  };

  // (2) CommContacts Role=Billing: attach the billing contact.
  const bc = abstract.billingContact ?? null;
  const contact: OutputSection = {
    heading: "2. Attach billing contact",
    entity: "CommContacts (Role = Billing)",
    lines: [
      { label: "First name", value: bc?.firstName ?? "-" },
      { label: "Last name", value: bc?.lastName ?? "-" },
      { label: "Company", value: bc?.company ?? "-" },
      { label: "Phone", value: bc?.phone ?? "-" },
      { label: "Email", value: bc?.email ?? "-" },
    ],
  };

  // (3) CommUnitXrefs / CommUnits: add the unit.
  const unit: OutputSection = {
    heading: "3. Add unit",
    entity: "CommUnitXrefs / CommUnits",
    lines: [
      { label: "Unit / suite", value: abstract.suite ?? "-" },
      { label: "Square footage", value: unitSizeSqft != null ? `${unitSizeSqft.toLocaleString()} SF` : "-" },
      { label: "% of RSF", value: proportionateShareRsf != null ? `${proportionateShareRsf.toFixed(2)}%` : "-" },
    ],
  };

  // (4) CommChargeSchedules: build the charge schedules. The Rent line carries
  // every escalation step; for MG leases an EstUtil recoveries line is emitted
  // alongside, derived from the stated estimate or a labeled estimate of rent.
  const chargeLines: OutputLine[] = [];
  schedule.forEach((step, i) => {
    const from = toIsoDate(step.from);
    const to = toIsoDate(step.to);
    const amount =
      step.monthlyRent != null
        ? `${money(step.monthlyRent)}/mo`
        : step.annualRentPerSqft != null && unitSizeSqft
        ? `${money((step.annualRentPerSqft * unitSizeSqft) / 12)}/mo`
        : step.annualRentPerSqft != null
        ? `$${step.annualRentPerSqft.toFixed(2)}/SF/yr`
        : "-";
    chargeLines.push({
      label: `Rent step ${i + 1} (${from} -> ${to})`,
      value: amount,
    });
  });
  if (chargeLines.length === 0) {
    chargeLines.push({ label: "Rent", value: "-" });
  }

  if (isMg) {
    // EstUtil line for modified-gross leases. Two cases only:
    // (a) abstract carries estimatedRecoveryPsf (a stated $/sqft figure from
    //     the rent roll or abstract) -> show the per-sqft value directly, the
    //     same way the Rent line shows annualRentPerSqft, rather than trying to
    //     derive a monthly dollar amount without a unit size.
    // (b) no stated estimatedRecoveryPsf -> fall back to ~9% of first-year
    //     annual rent, clearly labeled as an estimate.
    const firstStep = schedule[0];
    const firstYearAnnualRent =
      firstStep?.monthlyRent != null
        ? firstStep.monthlyRent * 12
        : firstStep?.annualRentPerSqft != null && unitSizeSqft
        ? firstStep.annualRentPerSqft * unitSizeSqft
        : null;
    const span =
      schedule.length > 0
        ? `${toIsoDate(schedule[0].from)} -> ${toIsoDate(schedule[schedule.length - 1].to)}`
        : `${toIsoDate(abstract.leaseStart)} -> ${toIsoDate(abstract.leaseEnd)}`;
    if (abstract.estimatedRecoveryPsf != null) {
      // (a) Stated $/sqft: present as a per-sqft value mirroring the Rent line.
      chargeLines.push({
        label: `EstUtil (estimated recovery) (${span})`,
        value: `$${abstract.estimatedRecoveryPsf.toFixed(2)}/sqft/yr`,
      });
    } else {
      // (b) No stated value: approximate at ~9% of first-year annual rent.
      const estUtilMonthly =
        firstYearAnnualRent != null ? (firstYearAnnualRent * 0.09) / 12 : null;
      chargeLines.push({
        label: `EstUtil (recoveries, estimated ~9% of rent) (${span})`,
        value: estUtilMonthly != null ? `${money(estUtilMonthly)}/mo` : "-",
      });
    }
  }

  // Recovery setup (Alex's 4-Jun ask): the stated operating-expense recovery
  // terms drive how Yardi bills recoveries, so surface them alongside the
  // EstUtil line in the charge-schedule step. Suppressed for gross leases
  // (recoveryType "gross_none") and when no recovery is stated, mirroring the
  // EstUtil suppression on non-MG leases: the landlord absorbs opex, so there
  // is nothing to set up.
  const oer = abstract.operatingExpenseRecovery ?? null;
  const showRecovery = oer != null && oer.recoveryType != null && oer.recoveryType !== "gross_none";
  if (showRecovery && oer) {
    chargeLines.push({ label: "Recovery type", value: oer.recoveryType ?? "-" });
    if (oer.baseYear != null) {
      chargeLines.push({ label: "Base year", value: String(oer.baseYear) });
    }
    const method = oer.recoveryMethod ?? "-";
    const share = oer.proRataSharePct != null ? `${oer.proRataSharePct.toFixed(2)}%` : null;
    chargeLines.push({
      label: "Recovery method",
      value: share != null ? `${method} (${share})` : method,
    });
    if (oer.reconciliationBasis != null) {
      chargeLines.push({ label: "Reconciliation basis", value: oer.reconciliationBasis });
    }
  }

  const recoveryEntitySuffix = showRecovery ? " + Recovery" : "";
  const charges: OutputSection = {
    heading: "4. Build charge schedules",
    entity: isMg
      ? `CommChargeSchedules (Rent + EstUtil${recoveryEntitySuffix})`
      : `CommChargeSchedules (Rent${recoveryEntitySuffix})`,
    lines: chargeLines,
  };

  // (5) Activate: the lease status.
  const statusLabel =
    abstract.status === "pushed_to_yardi"
      ? "Activated (pushed to Yardi)"
      : abstract.status === "approved"
      ? "Approved, ready to activate"
      : abstract.status === "awaiting_review"
      ? "Awaiting review (not yet activated)"
      : "Pending";
  const activate: OutputSection = {
    heading: "5. Activate",
    entity: "Lease status",
    lines: [{ label: "Status", value: statusLabel }],
  };

  return [lease, contact, unit, charges, activate];
}

export function PushToYardiModal(props: PushArgs) {
  const { abstract } = props;
  const sections = buildSections(props);

  function copyAll() {
    const text = sections
      .map((s) => {
        const header = `### ${s.heading} -> ${s.entity}`;
        const body = s.lines.map((l) => `${l.label}\t${l.value}`).join("\n");
        return `${header}\n${body}`;
      })
      .join("\n\n");
    void navigator.clipboard.writeText(text);
    toast.success("Copied the Yardi create-through-activate fields to clipboard");
  }

  return (
    <Dialog>
      <DialogTrigger render={props.trigger as React.ReactElement} />
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Push to Yardi (paste-ready, single-lease entry)</DialogTitle>
          <DialogDescription>
            The fields one person keys during the Yardi create-through-activate sequence, grouped by Yardi entity: create the lease, attach the billing contact, add the unit, build the charge schedules (the Rent line with every escalation step, plus the EstUtil recoveries line on modified-gross leases), and activate. Contact says &ldquo;-&rdquo; where the lease did not state it. The EstUtil line shows the stated recovery in $/sqft/yr when the abstract carries that figure; otherwise it is approximated at about 9% of rent and labeled as an estimate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.heading} className="rounded-sm border border-border">
              <div className="flex items-baseline justify-between gap-2 border-b border-border bg-background-subtle px-3 py-1.5">
                <span className="text-sm font-medium text-foreground">{section.heading}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                  {section.entity}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {section.lines.map((line, i) => (
                    <tr key={`${line.label}-${i}`} className="border-b border-border last:border-0">
                      <td className="py-1 pl-3 pr-3 font-medium align-top whitespace-nowrap">{line.label}</td>
                      <td className="py-1 pr-3 text-muted-foreground font-mono tabular-nums">{line.value || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <p className="text-xs text-foreground-faint">
          {abstract.tenantName ?? "This lease"}: {sections.reduce((n, s) => n + s.lines.length, 0)} fields across 5 Yardi steps.
        </p>

        <Button onClick={copyAll} variant="default" className="self-start">
          <Copy className="h-4 w-4 mr-2" />Copy all
        </Button>
      </DialogContent>
    </Dialog>
  );
}
