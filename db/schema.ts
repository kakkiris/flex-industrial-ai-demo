import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Properties being tracked, sourced from internal data, OMs, or CoStar.
// Expanded 2026-05-27 to align with the 54-column KFP rent roll structure.
export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  submarket: text("submarket"),
  state: text("state"),
  totalSqft: integer("total_sqft"),
  assetType: text("asset_type"),
  yearBuilt: integer("year_built"),
  // Rent roll filters
  geography: text("geography"),                          // city or polygon
  zipCode: text("zip_code"),
  county: text("county"),
  hasOffice: integer("has_office", { mode: "boolean" }), // Office Y/N at property level
  clearHeightFt: real("clear_height_ft"),                // Clear Height in feet
  marketRentYn: integer("market_rent_yn", { mode: "boolean" }),
  acquisitionDate: integer("acquisition_date", { mode: "timestamp" }),
  source: text("source"),                                // "internal" | "om" | "costar" | "bulk_load"
  sourceDocId: text("source_doc_id"),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
});

// Individual leasable units within a property.
// Expanded 2026-05-27 to align with the 54-column KFP rent roll. UW columns
// stay nullable until real UW data is loaded; legacy vs KFP split mirrors
// Alex's manual tagging on the master rent roll.
export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").references(() => properties.id),
  suite: text("suite"),
  sizeSqft: integer("size_sqft"),
  leaseType: text("lease_type"),                         // "NNN" | "MG" | "Gross"
  hasPrivateBathroom: integer("has_private_bathroom", { mode: "boolean" }),
  // Current rent + lease term
  currentRent: real("current_rent"),                     // monthly $
  rentPerSqft: real("rent_per_sqft"),                    // annual $/sqft
  annualRent: real("annual_rent"),                       // annual $
  leaseStart: integer("lease_start", { mode: "timestamp" }),
  leaseEnd: integer("lease_end", { mode: "timestamp" }),
  termYears: real("term_years"),
  tenantName: text("tenant_name"),
  tenantCategory: text("tenant_category"),               // pending capture for legacy units
  proportionateShareRsf: real("proportionate_share_rsf"),
  // Legacy vs KFP split (Alex's manual tagging)
  legacyRent: real("legacy_rent"),
  kfpRent: real("kfp_rent"),
  legacyTermYears: real("legacy_term_years"),
  kfpTermYears: real("kfp_term_years"),
  legacySf: integer("legacy_sf"),
  kfpSf: integer("kfp_sf"),
  // Underwriting comparison (nullable until UW data lands)
  rentUw: real("rent_uw"),                               // $/sqft underwritten
  trendedRentAtLease: real("trended_rent_at_lease"),
  performanceToUw: real("performance_to_uw"),
  leasedImpactUw: real("leased_impact_uw"),
  vacancyImpactUw: real("vacancy_impact_uw"),
  combinedImpactUw: real("combined_impact_uw"),
  // Recovery and deposit
  annualRecoveryPsf: real("annual_recovery_psf"),
  securityDeposit: real("security_deposit"),
});

// Raw source documents ingested into the system.
export const sourceDocuments = sqliteTable("source_documents", {
  id: text("id").primaryKey(),
  type: text("type"),                 // "om" | "lease" | "psa" | "internal_rent_roll"
  filename: text("filename"),
  pdfPath: text("pdf_path"),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
});

// Confidence metadata for rent comps at the unit level.
export const compConfidence = sqliteTable("comp_confidence", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id),
  rentConfidence: text("rent_confidence"),  // "high" | "medium" | "low"
  sourceType: text("source_type"),          // "signed_lease" | "om_rent_roll" | "costar_estimate"
  rawQuote: text("raw_quote"),
  extractedFromPage: integer("extracted_from_page"),
});

// Lease PDF files linked to units.
export const leases = sqliteTable("leases", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id),
  pdfPath: text("pdf_path"),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
});

// Structured abstracts extracted from lease PDFs.
// JSON blob columns: consumers call JSON.parse / JSON.stringify themselves.
export const leaseAbstracts = sqliteTable("lease_abstracts", {
  id: text("id").primaryKey(),
  leaseId: text("lease_id").references(() => leases.id),
  tenantName: text("tenant_name"),
  landlordName: text("landlord_name"),
  propertyAddress: text("property_address"),
  suite: text("suite"),
  leaseStart: integer("lease_start", { mode: "timestamp" }),
  leaseEnd: integer("lease_end", { mode: "timestamp" }),
  baseRentSchedule: text("base_rent_schedule"), // JSON: [{from,to,monthlyRent,annualRentPerSqft}]
  escalations: text("escalations"),             // JSON
  renewalOptions: text("renewal_options"),      // JSON
  tiAllowance: real("ti_allowance"),
  freeRentMonths: integer("free_rent_months"),
  securityDeposit: real("security_deposit"),
  camTerms: text("cam_terms"),                  // JSON
  // L2 Yardi-fit (added 2026-05-31)
  // billingContact: JSON for CommContacts Role=Billing (step 2). Shape
  // { firstName, lastName, company, phone, email }, every field nullable.
  billingContact: text("billing_contact"),
  // estimatedRecoveryPsf: annual EstUtil/recovery $/sqft for the second charge
  // line on modified-gross leases (step 4). Null on NNN leases.
  estimatedRecoveryPsf: real("estimated_recovery_psf"),
  operatingExpenseRecovery: text("operating_expense_recovery"), // JSON OperatingExpenseRecovery (Alex 4-Jun ask)
  useClause: text("use_clause"),
  specialProvisions: text("special_provisions"), // JSON array
  extractionConfidence: text("extraction_confidence"), // JSON per-field confidence scores
  extractionPath: text("extraction_path"),       // "text" | "vision" (L2 dual-path metadata)
  rawSections: text("raw_sections"),            // JSON: [{section, page, text}] used by C3 retrieval
  extractedAt: integer("extracted_at", { mode: "timestamp" }),
  // L2 review workflow (added 2026-05-27)
  source: text("source"),                        // "upload" | "seed" | "bulk_load" ("docusign" retired: leases now enter via manual upload of the signed PDF)
  status: text("status"),                        // "awaiting_review" | "approved" | "pushed_to_yardi"
  pushedToYardiAt: integer("pushed_to_yardi_at", { mode: "timestamp" }),
});

// Inbound leads from chat, voice, or form submissions. Restructured 2026-05-27 to
// drop budgetRange (not in Jordan's stated criteria) and add Tier 2 / Tier 3 fields
// per the L1 three-tier qualifier framework.
export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  source: text("source"),                             // "chat" | "voice" | "form"
  // Tier 1 (must-haves)
  businessType: text("business_type"),
  businessName: text("business_name"),
  spaceSizeSqft: integer("space_size_sqft"),
  location: text("location"),
  // Tier 2 (capture if conversation allows)
  timeline: text("timeline"),
  leaseTermYears: real("lease_term_years"),
  // Tier 3 (nice to have)
  existingLocations: text("existing_locations"),      // "existing" | "new" | free text
  motivation: text("motivation"),
  loadingNeeds: text("loading_needs"),                // "dock_high" | "grade_level" | free text
  callbackPreferred: integer("callback_preferred", { mode: "boolean" }),
  rawTranscript: text("raw_transcript"),
  tierMap: text("tier_map"),                          // JSON: { [field]: "tier1"|"tier2"|"tier3" }
  // L1 qualification (added 2026-05-27)
  verdict: text("verdict"),                           // "qualified" | "unqualified" | "manual_review"
  confidenceScore: integer("confidence_score"),       // 0-100
  reasoning: text("reasoning"),                       // one-sentence explanation
  // L1 manual inbox actions (added 2026-05-27 follow-up pass)
  phone: text("phone"),                               // captured during chat, used by call-back CTA
  manualVerdict: text("manual_verdict"),              // "approved" | "rejected", overrides AI verdict
  scheduledVisitAt: integer("scheduled_visit_at", { mode: "timestamp" }),
  actionedAt: integer("actioned_at", { mode: "timestamp" }),
  actionedBy: text("actioned_by"),
  // L1 form-backend reframe (added 2026-05-31). Units the matcher found in
  // current vacant inventory at submit time. JSON:
  // [{ propertyName, submarket, suite, sizeSqft, leaseType }].
  matchedUnits: text("matched_units"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

// Chat sessions tied to leads. Transcript is a JSON array of messages.
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").references(() => leads.id),
  startedAt: integer("started_at", { mode: "timestamp" }),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  transcript: text("transcript"),     // JSON: [{role, content, timestamp}]
});

// Log of natural-language queries answered by the AI assistant.
export const queryLog = sqliteTable("query_log", {
  id: text("id").primaryKey(),
  query: text("query"),
  response: text("response"),
  citations: text("citations"),       // JSON
  responseTimeMs: integer("response_time_ms"),
  timestamp: integer("timestamp", { mode: "timestamp" }),
});

// App-level notifications surfaced to the Keystone team.
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  kind: text("kind"),                 // "qualified_lead" | "extraction_complete" | "bulk_load_complete"
  title: text("title"),
  body: text("body"),
  link: text("link"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  readAt: integer("read_at", { mode: "timestamp" }),
});
