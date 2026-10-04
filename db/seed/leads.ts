// Optional demo seed: a few form-backed leads so the L1 Leasing Team Inbox is
// non-empty on first load. Leads are never seeded in production; this is purely
// so the demo walkthrough shows verdict badges, the structured submission view,
// and the matched-units panel without first submitting the form.
//
// Matched units are computed from the real seeded vacant inventory via the same
// matchUnits the live endpoint uses, so the demo data and the live path stay
// consistent (rent-independent ranking on submarket + size band).

import { id } from "@/lib/ids";
import { matchUnits } from "@/lib/match-units";
import type { AvailableUnit } from "@/lib/prompts/leasing-chat";

type Verdict = "qualified" | "unqualified" | "manual_review";

type SeedLead = {
  location: string;
  spaceSizeSqft: number;
  businessType: string;
  businessName: string;
  additionalCriteria: string;
  timeline: string | null;
  leaseTermYears: number | null;
  loadingNeeds: string | null;
  existingLocations: string | null;
  motivation: string | null;
  callbackPreferred: boolean;
  phone: string | null;
  tierMap: Record<string, "tier1" | "tier2" | "tier3">;
  verdict: Verdict;
  confidenceScore: number;
  reasoning: string;
};

const SEED_LEADS: SeedLead[] = [
  {
    location: "Brightwater",
    spaceSizeSqft: 1800,
    businessType: "HVAC contractor",
    businessName: "Coastal Climate Mechanical LLC",
    additionalCriteria: "Need to move in by August, looking at a 5-year term, grade-level loading.",
    timeline: "August 2026",
    leaseTermYears: 5,
    loadingNeeds: "grade_level",
    existingLocations: "existing",
    motivation: "outgrew current shop",
    callbackPreferred: true,
    phone: "(555) 555-0142",
    tierMap: {
      businessType: "tier1",
      businessName: "tier1",
      spaceSizeSqft: "tier1",
      location: "tier1",
      timeline: "tier2",
      leaseTermYears: "tier2",
      loadingNeeds: "tier3",
    },
    verdict: "qualified",
    confidenceScore: 88,
    reasoning: "HVAC contractor needing 1800 sqft in Brightwater fits KFP's profile cleanly.",
  },
  {
    location: "Ashby Beach",
    spaceSizeSqft: 3200,
    businessType: "e-commerce fulfillment",
    businessName: "Reef Supply Co",
    additionalCriteria: "Expanding from a garage operation, flexible on timing, would like dock-high if available.",
    timeline: null,
    leaseTermYears: 3,
    loadingNeeds: "dock_high",
    existingLocations: "new",
    motivation: "scaling out of a home garage",
    callbackPreferred: false,
    phone: null,
    tierMap: {
      businessType: "tier1",
      businessName: "tier1",
      spaceSizeSqft: "tier1",
      location: "tier1",
      leaseTermYears: "tier2",
      loadingNeeds: "tier3",
    },
    verdict: "manual_review",
    confidenceScore: 55,
    reasoning: "Fulfillment fit and size are in band, but timeline is unstated so the lead needs a human check.",
  },
  {
    location: "Ellery",
    spaceSizeSqft: 900,
    businessType: "retail storefront",
    businessName: "Sunline Boutique",
    additionalCriteria: "Walk-in customers, want street frontage on a busy retail corridor.",
    timeline: "September 2026",
    leaseTermYears: 2,
    loadingNeeds: null,
    existingLocations: "new",
    motivation: "opening a first storefront",
    callbackPreferred: false,
    phone: null,
    tierMap: {
      businessType: "tier1",
      businessName: "tier1",
      spaceSizeSqft: "tier1",
      location: "tier1",
      timeline: "tier2",
      leaseTermYears: "tier2",
    },
    verdict: "unqualified",
    confidenceScore: 90,
    reasoning: "Public-facing retail storefront is outside KFP's flex industrial profile.",
  },
];

function serializeFormSubmission(lead: SeedLead): string {
  return [
    `Location: ${lead.location}`,
    `Square footage: ${lead.spaceSizeSqft} sqft`,
    `Business type: ${lead.businessType}`,
    `Business name: ${lead.businessName}`,
    `Additional criteria: ${lead.additionalCriteria}`,
  ].join("\n");
}

export type SeededLeadRow = {
  id: string;
  source: "form";
  businessType: string;
  businessName: string;
  spaceSizeSqft: number;
  location: string;
  timeline: string | null;
  leaseTermYears: number | null;
  existingLocations: string | null;
  motivation: string | null;
  loadingNeeds: string | null;
  callbackPreferred: boolean;
  rawTranscript: string;
  tierMap: string;
  verdict: Verdict;
  confidenceScore: number;
  reasoning: string;
  phone: string | null;
  manualVerdict: null;
  scheduledVisitAt: null;
  actionedAt: null;
  actionedBy: null;
  matchedUnits: string;
  createdAt: Date;
};

// Builds the demo form leads, attaching real matched units drawn from the
// supplied vacant inventory so the inbox match panel is populated.
export function buildLeads(vacantUnits: AvailableUnit[]): SeededLeadRow[] {
  const now = Date.now();
  return SEED_LEADS.map((lead, index) => {
    const matched = matchUnits(
      { sqft: lead.spaceSizeSqft, submarket: lead.location, leaseType: null },
      vacantUnits,
    );
    return {
      id: id("lead"),
      source: "form" as const,
      businessType: lead.businessType,
      businessName: lead.businessName,
      spaceSizeSqft: lead.spaceSizeSqft,
      location: lead.location,
      timeline: lead.timeline,
      leaseTermYears: lead.leaseTermYears,
      existingLocations: lead.existingLocations,
      motivation: lead.motivation,
      loadingNeeds: lead.loadingNeeds,
      callbackPreferred: lead.callbackPreferred,
      rawTranscript: serializeFormSubmission(lead),
      tierMap: JSON.stringify(lead.tierMap),
      verdict: lead.verdict,
      confidenceScore: lead.confidenceScore,
      reasoning: lead.reasoning,
      phone: lead.phone,
      manualVerdict: null,
      scheduledVisitAt: null,
      actionedAt: null,
      actionedBy: null,
      matchedUnits: JSON.stringify(matched),
      // Stagger creation so the inbox shows a realistic spread.
      createdAt: new Date(now - index * 3_600_000),
    };
  });
}
