import { z } from "zod";
import { ConfidenceMap } from "@/lib/confidence";

export const RentStep = z.object({
  from: z.string(),                       // ISO date
  to: z.string(),                         // ISO date
  // Real leases often state rent in one form only (annual $/sqft OR monthly $),
  // not both. The extractor returns null for the form not stated rather than
  // inventing the conversion (which requires the unit's RSF, which the lease
  // itself may not carry inline). Downstream consumers null-guard the display.
  monthlyRent: z.number().nullable(),
  annualRentPerSqft: z.number().nullable(),
});
export type RentStep = z.infer<typeof RentStep>;

export const RenewalOption = z.object({
  number: z.number().int(),
  termYears: z.number(),
  noticeRequired: z.string().nullable(),
});

export const Escalations = z.object({
  type: z.enum(["fixed_pct", "stepped", "cpi", "none"]),
  details: z.string().nullable(),
});

export const CamTerms = z.object({
  type: z.enum(["NNN", "MG", "Gross"]),
  recoveryMethod: z.string().nullable(),
  caps: z.string().nullable(),
});

// The billing/notice contact who receives invoices for the lease. This becomes
// the Yardi CommContacts Role=Billing row (step 2 of the create-through-activate
// sequence). Mirrors A5's RentRollBillingContact, but every field is nullable
// here: a lease PDF without a clear contact (often only an entity name in the
// Notices block) must not error. Downstream consumers null-guard the display.
export const BillingContact = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  company: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});
export type BillingContact = z.infer<typeof BillingContact>;

export const RawSection = z.object({
  section: z.string(),
  page: z.number().int(),
  text: z.string(),
});
export type RawSection = z.infer<typeof RawSection>;

// Stated operating-expense recovery terms (Alex's 4-Jun ask: the most billing-
// critical Yardi field). Extracted from the lease's Operating Expenses / Additional
// Rent / CAM / Taxes / Insurance clauses. Stated terms only; reconciliation math
// against budgets is out of scope (the lease does not carry budget data).
export const OperatingExpenseRecovery = z.object({
  recoveryType: z.enum(["nnn_full", "base_year_stop", "modified_gross", "gross_none", "custom"]).nullable(),
  baseYear: z.number().int().nullable(),
  recoveryMethod: z.enum(["pro_rata_share", "fixed", "custom"]).nullable(),
  proRataSharePct: z.number().nullable(),
  expenseCategories: z.array(z.string()),
  capPct: z.number().nullable(),
  reconciliationBasis: z.enum(["calendar_year", "lease_year"]).nullable(),
  notes: z.string().nullable(),
});
export type OperatingExpenseRecovery = z.infer<typeof OperatingExpenseRecovery>;

export const LeaseAbstract = z.object({
  tenantName: z.string(),
  landlordName: z.string(),
  propertyAddress: z.string(),
  suite: z.string(),
  leaseStart: z.string(),                 // ISO date
  leaseEnd: z.string(),                   // ISO date
  baseRentSchedule: z.array(RentStep),
  escalations: Escalations,
  renewalOptions: z.array(RenewalOption),
  tiAllowancePerSqft: z.number().nullable(),
  freeRentMonths: z.number().int().nullable(),
  securityDeposit: z.number().nullable(),
  cam: CamTerms,
  // The billing/notice contact for Yardi CommContacts Role=Billing (step 2).
  // Nullable so a lease without a clear contact does not fail extraction.
  billingContact: BillingContact.nullable(),
  // Estimated annual recovery / EstUtil $/sqft for modified-gross leases. This
  // feeds the second Yardi charge-schedule line (the EstUtil/recoveries line)
  // alongside Rent. Null on NNN leases (the tenant pays recoveries directly) or
  // when the lease does not state an estimate; the output then derives a modest
  // estimate from the rent. Kept as $/sqft to match the rent schedule unit.
  estimatedRecoveryPsf: z.number().nullable(),
  // Stated operating-expense recovery terms (Alex 4-Jun ask). Nullable+optional
  // so abstracts committed before this field still parse.
  operatingExpenseRecovery: OperatingExpenseRecovery.nullable().optional(),
  useClause: z.string().nullable(),
  specialProvisions: z.array(z.string()),
  rawSections: z.array(RawSection),
  confidence: ConfidenceMap,
});
export type LeaseAbstract = z.infer<typeof LeaseAbstract>;

export type ExtractLeasePromptArgs = {
  // Optional hint about which property / suite the file refers to. Helps the
  // model cross-check the address it finds.
  knownAddress?: string;
};

export function extractLeasePrompt(args: ExtractLeasePromptArgs = {}): {
  system: string;
  user: string;
} {
  const system = `You are extracting key terms from a commercial lease agreement. The lease is attached as a PDF. Output ONLY a single JSON object matching the schema described in the user message. Do not add commentary, do not explain your work, do not wrap the JSON in markdown fences.

Rules:
- Never invent terms. If a field is unclear or absent, set the matching confidence entry to "low" and explain in the reason. Use null where the schema allows.
- For base rent schedule, capture every step including all annual escalations as separate entries.
- Capture the billing/notice contact in billingContact: the person and company who receive invoices and legal notices, usually named in the Notices section. Set any field you cannot find to null (do not invent a name or email); on an entity-only lease the company carries the identity and the person fields stay null.
- For modified-gross (MG) leases, set estimatedRecoveryPsf to the lease's stated annual estimated operating-expense recovery in $/sqft (the EstUtil / CAM-estimate line) if it is stated; otherwise null. For NNN or Gross leases set it null.
- Extract operatingExpenseRecovery from the Operating Expenses / Additional Rent / CAM / Taxes / Insurance clauses, capturing only the STATED lease terms (do not compute reconciliation math; the lease carries no budget data). recoveryType meanings: nnn_full = tenant pays its full pro-rata share of all operating expenses (true triple net); base_year_stop = tenant pays only the increases over a stated base year; modified_gross = landlord absorbs some expenses, tenant pays a stated subset; gross_none = gross lease, landlord absorbs operating expenses; custom = anything that does not fit the above. Use null for any sub-field the lease does not state, and [] for expenseCategories when none are listed. When the recovery structure is ambiguous, set a low confidence entry for operatingExpenseRecovery and explain in the reason.
- Use ISO-8601 dates (YYYY-MM-DD).
- Mark any non-standard provisions in specialProvisions as short strings.
- In rawSections, return the 4 to 6 most relevant sections (Use Clause, Rent Schedule, Operating Expenses or CAM, Maintenance, Insurance, Default, Special Provisions if any). Always include the Operating Expenses / Additional Rent / CAM recovery clause verbatim when present, so the stated recovery terms can be cited. Each entry must include the section heading, page number, and the text excerpt verbatim from the lease.`;

  const addressHint = args.knownAddress
    ? `\nThis lease is known to refer to the property at: ${args.knownAddress}. Use this to disambiguate if the lease body is unclear.`
    : "";

  const user = `Extract the lease abstract from the attached PDF.

Return a single JSON object with this exact shape:
{
  "tenantName": string,
  "landlordName": string,
  "propertyAddress": string,
  "suite": string,
  "leaseStart": "YYYY-MM-DD",
  "leaseEnd": "YYYY-MM-DD",
  "baseRentSchedule": [{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "monthlyRent": number | null, "annualRentPerSqft": number | null }],
  "escalations": { "type": "fixed_pct" | "stepped" | "cpi" | "none", "details": string | null },
  "renewalOptions": [{ "number": int, "termYears": number, "noticeRequired": string | null }],
  "tiAllowancePerSqft": number | null,
  "freeRentMonths": int | null,
  "securityDeposit": number | null,
  "cam": { "type": "NNN" | "MG" | "Gross", "recoveryMethod": string | null, "caps": string | null },
  "billingContact": { "firstName": string | null, "lastName": string | null, "company": string | null, "phone": string | null, "email": string | null } | null,
  "estimatedRecoveryPsf": number | null,
  "operatingExpenseRecovery": { "recoveryType": "nnn_full" | "base_year_stop" | "modified_gross" | "gross_none" | "custom" | null, "baseYear": int | null, "recoveryMethod": "pro_rata_share" | "fixed" | "custom" | null, "proRataSharePct": number | null, "expenseCategories": [string], "capPct": number | null, "reconciliationBasis": "calendar_year" | "lease_year" | null, "notes": string | null },
  "useClause": string | null,
  "specialProvisions": [string],
  "rawSections": [{ "section": string, "page": int, "text": string }],
  "confidence": { "<field>": { "level": "high" | "medium" | "low", "reason": string } }
}${addressHint}`;

  return { system, user };
}
