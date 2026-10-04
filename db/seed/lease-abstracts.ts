import { id } from "@/lib/ids";
import type { buildUnits } from "./units";

type Unit = ReturnType<typeof buildUnits>[number];

// 3 form-style abstracts (text-path extraction in production)
// + 3 negotiated abstracts (vision-path).
// Each carries 5-8 rawSections. The set is engineered so the four canonical
// C3 queries (HVAC responsibility, expirations next quarter, NER comparison,
// renewal-options summary) all return meaningful hits.
//
// Date strategy (audit 2026-05-27): three leases (Gulf Coast HVAC, FastShip,
// Calder Print) are aged so they expire in Q4 2026; this populates the
// "leases expiring next quarter" structured side path with real candidates.
// Other three carry longer terms for renewal / NER variety.
//
// Renewal options are now PER LEASE (previously one canned blob for all six).
// Variety pushed into the rawSections "Renewal Option" entry as well so the
// FTS5 path can answer "Renewal options summary" without falling back on the
// structured side path. Free-rent and TI now have their own rawSections where
// the spec carries non-null values, so NER comparison can pull them via FTS.

type AbstractSpec = {
  form: boolean;
  extractionPath: "text" | "vision";
  tenantName: string;
  tenantCategory: string;
  landlordName: string;
  suite: string;
  yearsAgo: number;
  termYears: number;
  rentPerSqft: number;
  sqft: number;
  tiAllowance: number | null;
  freeRentMonths: number;
  securityDeposit: number;
  // Billing/notice contact for Yardi CommContacts Role=Billing (step 2). Any
  // field may be null on an entity-only lease (mirrors A5's contact discipline).
  billingContact: {
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    email: string | null;
  };
  // "MG" leases carry an estimatedRecoveryPsf for the EstUtil charge line.
  leaseType: "NNN" | "MG";
  estimatedRecoveryPsf: number | null;
  // Stated operating-expense recovery terms. Null on leases
  // where the recovery structure is not modeled. When set, the spec also carries
  // a matching "Operating Expenses / Additional Rent" rawSection so C3 can cite
  // the stated terms.
  operatingExpenseRecovery: {
    recoveryType: "nnn_full" | "base_year_stop" | "modified_gross" | "gross_none" | "custom" | null;
    baseYear: number | null;
    recoveryMethod: "pro_rata_share" | "fixed" | "custom" | null;
    proRataSharePct: number | null;
    expenseCategories: string[];
    capPct: number | null;
    reconciliationBasis: "calendar_year" | "lease_year" | null;
    notes: string | null;
  } | null;
  useClause: string;
  hvacResponsibility: "tenant" | "landlord" | "shared";
  renewal: {
    periods: number;
    termYears: number;
    noticeMonths: number;
    rentType: "fair_market_value" | "fixed_escalation" | "none";
    escalationPct?: number;
  } | null;
  sections: Array<{ section: string; page: number; text: string }>;
  confidence: Record<string, "high" | "medium" | "low">;
};

const ABSTRACT_SPECS: AbstractSpec[] = [
  // Form-style 1: Gulf Coast HVAC - EXPIRES Q4 2026
  {
    form: true,
    extractionPath: "text",
    tenantName: "Gulf Coast HVAC Solutions",
    tenantCategory: "HVAC contractor",
    landlordName: "Keystone Capital LLC",
    suite: "101",
    yearsAgo: 4.5,
    termYears: 5,
    rentPerSqft: 13.5,
    sqft: 2200,
    tiAllowance: null,
    freeRentMonths: 0,
    securityDeposit: 4950,
    billingContact: { firstName: "Hector", lastName: "Alvarez", company: "Gulf Coast HVAC Solutions", phone: "(555) 555-0110", email: "billing@gulfcoasthvac.example.com" },
    leaseType: "MG",
    estimatedRecoveryPsf: 3.2,
    operatingExpenseRecovery: {
      recoveryType: "base_year_stop",
      baseYear: 2024,
      recoveryMethod: "pro_rata_share",
      proRataSharePct: 8.3,
      expenseCategories: ["taxes", "insurance", "cam"],
      capPct: 5,
      reconciliationBasis: "calendar_year",
      notes: "Tenant pays increases over the 2024 base year, 5% cap on controllables.",
    },
    useClause: "Tenant may use the premises solely for HVAC contracting operations, including storage of equipment and materials incidental to the trade.",
    hvacResponsibility: "tenant",
    renewal: { periods: 1, termYears: 5, noticeMonths: 9, rentType: "fair_market_value" },
    sections: [
      { section: "1. Use Clause", page: 3, text: "Tenant may use the premises solely for HVAC contracting operations, including storage of equipment and materials incidental to the trade. Any change in use requires prior written consent of Landlord." },
      { section: "4. Base Rent and Escalations", page: 5, text: "Year 1: $13.50/sqft NNN. Year 2: $13.91/sqft. Year 3: $14.33/sqft. Year 4: $14.76/sqft. Year 5: $15.20/sqft. Annual escalation: 3% fixed." },
      { section: "5. Free Rent Concession", page: 6, text: "No free rent concession granted under this Lease. Rent is payable in full beginning the Commencement Date." },
      { section: "Operating Expenses / Additional Rent", page: 14, text: "This is a modified-gross lease. Tenant shall pay as Additional Rent its pro-rata share (8.3% of the park) of the amount by which Operating Expenses for each calendar year exceed the Operating Expenses for the 2024 base year. Operating Expenses include real estate taxes, insurance, and common area maintenance. Increases in controllable Operating Expenses are capped at five percent (5%) per year over the prior year. Landlord shall reconcile actual Operating Expenses against estimated payments within ninety (90) days of each calendar year end." },
      { section: "7. Maintenance and HVAC", page: 12, text: "Tenant is responsible for routine HVAC maintenance including filter changes, belt replacements, and coil cleaning. Landlord responsible for structural repairs and roof. Tenant to maintain rooftop unit in good working order." },
      { section: "9. Operating Expenses (CAM)", page: 15, text: "Tenant pays its pro-rata share of common area maintenance costs. Pro-rata share: 8.3% of park. CAM expenses capped at 5% annual increase over prior year actual." },
      { section: "11. Renewal Option", page: 17, text: "Tenant shall have one (1) renewal option of five (5) years at the then-prevailing fair market rent. Tenant must deliver written notice of exercise to Landlord not less than nine (9) months prior to expiration of the initial term." },
      { section: "12. Insurance", page: 18, text: "Tenant shall maintain general liability insurance with minimum limits of $2,000,000 per occurrence and $4,000,000 aggregate. Landlord to be named as additional insured." },
      { section: "16. Default", page: 22, text: "Failure to pay rent within 5 days of due date constitutes monetary default. Landlord shall provide written notice and 10-day cure period for monetary defaults, 30-day cure for non-monetary defaults." },
    ],
    confidence: {
      tenantName: "high", leaseStart: "high", leaseEnd: "high",
      baseRentSchedule: "high", escalations: "high", camTerms: "medium",
      useClause: "high", tiAllowance: "high", securityDeposit: "high",
      renewalOptions: "high", freeRentMonths: "high",
    },
  },

  // Form-style 2: Precision Metal - expires ~May 2027 (within 12mo horizon)
  {
    form: true,
    extractionPath: "text",
    tenantName: "Precision Metal Fabrication Inc",
    tenantCategory: "metal fabrication",
    landlordName: "Keystone Capital LLC",
    suite: "105",
    yearsAgo: 3,
    termYears: 4,
    rentPerSqft: 12.75,
    sqft: 3100,
    tiAllowance: null,
    freeRentMonths: 1,
    securityDeposit: 6600,
    billingContact: { firstName: "Sandra", lastName: "Okafor", company: "Precision Metal Fabrication Inc", phone: "(555) 555-0124", email: "ap@precisionmetalfab.example.com" },
    leaseType: "NNN",
    estimatedRecoveryPsf: null,
    operatingExpenseRecovery: {
      recoveryType: "nnn_full",
      baseYear: null,
      recoveryMethod: "pro_rata_share",
      proRataSharePct: 10.2,
      expenseCategories: ["taxes", "insurance", "cam", "management"],
      capPct: null,
      reconciliationBasis: "calendar_year",
      notes: "Tenant pays its pro-rata share of all operating expenses (NNN).",
    },
    useClause: "Tenant may use the premises solely for metal fabrication, welding, and related light manufacturing activities.",
    hvacResponsibility: "tenant",
    renewal: { periods: 2, termYears: 5, noticeMonths: 9, rentType: "fixed_escalation", escalationPct: 3.0 },
    sections: [
      { section: "1. Use Clause", page: 3, text: "Tenant may use the premises solely for metal fabrication, welding, and related light manufacturing activities. Tenant shall comply with all applicable zoning regulations and fire codes pertaining to welding operations." },
      { section: "4. Base Rent and Escalations", page: 5, text: "Year 1: $12.75/sqft NNN. Year 2: $13.13/sqft. Year 3: $13.52/sqft. Year 4: $13.93/sqft. CPI adjustment clause applies if CPI exceeds 5% in any lease year." },
      { section: "5. Free Rent Concession", page: 6, text: "Landlord grants Tenant one (1) month of free base rent applicable to Month 1 only. CAM and other operating costs remain payable during the free rent month." },
      { section: "Operating Expenses / Additional Rent", page: 14, text: "This is a triple-net (NNN) lease. In addition to Base Rent, Tenant shall pay as Additional Rent its full pro-rata share (10.2% of the park) of all Operating Expenses, including real estate taxes, insurance, common area maintenance, and a management fee. There is no base year and no cap on pass-throughs. Landlord shall reconcile actual Operating Expenses against estimated monthly payments within ninety (90) days of each calendar year end." },
      { section: "7. Maintenance and HVAC", page: 12, text: "Tenant is responsible for routine HVAC maintenance. Given Tenant's industrial use, Tenant shall also maintain an exhaust ventilation system approved by Landlord. Landlord responsible for structural and roof." },
      { section: "9. Operating Expenses (CAM)", page: 15, text: "Tenant pays its pro-rata share of common area maintenance costs estimated at $1.20/sqft annually. Actual reconciliation performed annually within 90 days of calendar year end." },
      { section: "11. Renewal Option", page: 17, text: "Tenant shall have two (2) consecutive renewal options of five (5) years each. Base rent for each renewal term continues at the same fixed three percent (3%) per annum escalation schedule applicable in the initial term. Notice of exercise: nine (9) months prior to expiration." },
      { section: "12. Insurance", page: 18, text: "Tenant shall maintain general liability insurance of $1,000,000 per occurrence. Additionally, Tenant must carry workers compensation and employer liability coverage per statutory requirements." },
    ],
    confidence: {
      tenantName: "high", leaseStart: "high", leaseEnd: "high",
      baseRentSchedule: "high", escalations: "medium", camTerms: "high",
      useClause: "high", tiAllowance: "high", securityDeposit: "high",
      renewalOptions: "high", freeRentMonths: "high",
    },
  },

  // Form-style 3: FastShip E-Commerce - EXPIRES Q4 2026
  {
    form: true,
    extractionPath: "text",
    tenantName: "FastShip E-Commerce LLC",
    tenantCategory: "e-commerce fulfillment",
    landlordName: "Keystone Capital LLC",
    suite: "110",
    yearsAgo: 2.5,
    termYears: 3,
    rentPerSqft: 14.0,
    sqft: 2800,
    tiAllowance: null,
    freeRentMonths: 0,
    securityDeposit: 9800,
    billingContact: { firstName: "Tyler", lastName: "Brandt", company: "FastShip E-Commerce LLC", phone: "(555) 555-0166", email: "finance@fastship.example.com" },
    leaseType: "NNN",
    estimatedRecoveryPsf: null,
    operatingExpenseRecovery: {
      recoveryType: "gross_none",
      baseYear: null,
      recoveryMethod: null,
      proRataSharePct: null,
      expenseCategories: [],
      capPct: null,
      reconciliationBasis: null,
      notes: "Gross lease; landlord absorbs operating expenses.",
    },
    useClause: "Tenant may use the premises solely for e-commerce order fulfillment, light distribution, and ancillary office use not to exceed 15% of premises.",
    hvacResponsibility: "tenant",
    renewal: null,
    sections: [
      { section: "1. Use Clause", page: 3, text: "Tenant may use the premises solely for e-commerce order fulfillment, light distribution, and ancillary office use not to exceed 15% of premises. No retail sales to the public permitted." },
      { section: "4. Base Rent and Escalations", page: 5, text: "Year 1: $14.00/sqft ($32,667/month). Year 2: $14.42/sqft. Year 3: $14.85/sqft. Fixed 3% annual escalation." },
      { section: "5. Free Rent Concession", page: 6, text: "No free rent concession granted under this Lease. Rent commences on the Commencement Date in full." },
      { section: "Operating Expenses / Additional Rent", page: 14, text: "This is a gross lease. Base Rent is fully gross and Landlord shall pay all Operating Expenses for the Premises, including real estate taxes, insurance, and common area maintenance. Tenant is not responsible for any pass-through of Operating Expenses and there is no annual reconciliation. Tenant remains responsible only for its own separately metered utilities and janitorial within the Premises." },
      { section: "7. Maintenance and HVAC", page: 12, text: "Tenant is responsible for routine HVAC maintenance including quarterly service contracts. Tenant to provide Landlord with service records upon request. Landlord responsible for capital HVAC replacement exceeding $2,500." },
      { section: "9. Operating Expenses (CAM)", page: 15, text: "Tenant pays its pro-rata share of common area maintenance costs. Pro-rata share: 10.5% of park total. Controllable CAM capped at 4% annual increase." },
      { section: "11. Renewal Option", page: 17, text: "No renewal options are granted under this Lease. Tenant and Landlord may, by mutual written agreement, negotiate a new lease prior to expiration; nothing in this Lease obligates either party to do so." },
      { section: "16. Default", page: 22, text: "Failure to pay rent within 5 days of due date constitutes default. Landlord to provide 5-day written notice to cure. Three defaults in any 12-month period constitutes incurable default." },
    ],
    confidence: {
      tenantName: "high", leaseStart: "high", leaseEnd: "high",
      baseRentSchedule: "high", escalations: "high", camTerms: "high",
      useClause: "high", tiAllowance: "high", securityDeposit: "low",
      renewalOptions: "high", freeRentMonths: "high",
    },
  },

  // Negotiated 1: Brightwater Distribution - long-term, rich renewal + TI
  {
    form: false,
    extractionPath: "vision",
    tenantName: "Brightwater Distribution Partners",
    tenantCategory: "distribution",
    landlordName: "Keystone Capital LLC",
    suite: "201",
    yearsAgo: 1,
    termYears: 7,
    rentPerSqft: 13.0,
    sqft: 4200,
    tiAllowance: 12.0,
    freeRentMonths: 2,
    securityDeposit: 18200,
    billingContact: { firstName: "Renee", lastName: "Castillo", company: "Brightwater Distribution Partners", phone: "(555) 555-0199", email: "ap@brightwaterdistribution.example.com" },
    leaseType: "MG",
    estimatedRecoveryPsf: 4.1,
    operatingExpenseRecovery: null,
    useClause: "Tenant may use the premises for regional distribution operations, light assembly, and ancillary office and administrative functions.",
    hvacResponsibility: "shared",
    renewal: { periods: 2, termYears: 3, noticeMonths: 12, rentType: "fair_market_value" },
    sections: [
      { section: "1. Use Clause", page: 3, text: "Tenant may use the premises for regional distribution operations, light assembly, and ancillary office and administrative functions. Tenant's use shall not generate noise, odor, or vibration detectable beyond the demised premises." },
      { section: "4. Base Rent and Escalations", page: 5, text: "Year 1-2: $13.00/sqft NNN ($45,500/month). Year 3: $13.39/sqft. Year 4-5: $13.79/sqft. Year 6-7: $14.21/sqft. Blended 3% per annum escalation." },
      { section: "5. Free Rent Concession", page: 6, text: "Landlord grants Tenant two (2) full months of free base rent applicable to Months 1 and 2 of the initial term. CAM and other pass-through charges remain payable during the free rent period." },
      { section: "6. Tenant Improvement Allowance", page: 8, text: "Landlord shall provide a Tenant Improvement allowance of $12.00 per rentable square foot ($50,400 total) toward Tenant's build-out. TI allowance disbursed in two equal installments: 50% at possession, 50% upon Tenant opening for business and submission of lien waivers." },
      { section: "7. Maintenance and HVAC", page: 12, text: "Tenant is responsible for routine HVAC maintenance. Landlord shall replace HVAC units with remaining useful life under 3 years at commencement. HVAC warranty documentation provided to Tenant at possession." },
      { section: "9. Operating Expenses (CAM)", page: 15, text: "Tenant pays its pro-rata share (15.8%) of common area maintenance. CAM reconciliation annually. Capital expenditures excluded from CAM. Management fee capped at 3% of gross revenues." },
      { section: "11. Renewal Option", page: 17, text: "Tenant shall have two (2) successive renewal options of three (3) years each, exercisable at the then-prevailing fair market rent. Notice of exercise must be delivered not less than twelve (12) months prior to the expiration of the then-current term." },
      { section: "12. Insurance", page: 18, text: "Tenant shall maintain general liability insurance of $2,000,000 per occurrence and $5,000,000 umbrella. Property insurance on Tenant's personal property at replacement value." },
      { section: "19. Special Provisions", page: 24, text: "Tenant has a 30-day exclusive lease-up option on adjacent Suite 202 (approx. 2,100 SF) at the same per-sqft rate as this Lease, exercisable only during months 12-18 of the initial term." },
    ],
    confidence: {
      tenantName: "high", leaseStart: "high", leaseEnd: "high",
      baseRentSchedule: "high", escalations: "high", camTerms: "high",
      useClause: "high", tiAllowance: "medium", securityDeposit: "high",
      renewalOptions: "high", freeRentMonths: "high", specialProvisions: "medium",
    },
  },

  // Negotiated 2: Sunbelt Auto - recently signed, short renewal
  {
    form: false,
    extractionPath: "vision",
    tenantName: "Sunbelt Auto Detailing Group",
    tenantCategory: "auto services",
    landlordName: "Keystone Capital LLC",
    suite: "115",
    yearsAgo: 0,
    termYears: 5,
    rentPerSqft: 11.5,
    sqft: 1800,
    tiAllowance: 8.0,
    freeRentMonths: 1,
    securityDeposit: 3450,
    billingContact: { firstName: "Diego", lastName: "Moreno", company: "Sunbelt Auto Detailing Group", phone: "(555) 555-0177", email: "billing@sunshineauto.example.com" },
    leaseType: "NNN",
    estimatedRecoveryPsf: null,
    operatingExpenseRecovery: null,
    useClause: "Tenant may use the premises solely for automotive detailing, hand wash, and minor cosmetic services. No mechanical repair or body work permitted.",
    hvacResponsibility: "tenant",
    renewal: { periods: 1, termYears: 3, noticeMonths: 6, rentType: "fair_market_value" },
    sections: [
      { section: "1. Use Clause", page: 3, text: "Tenant may use the premises solely for automotive detailing, hand wash, and minor cosmetic services. No mechanical repair or body work permitted. Tenant to maintain proper disposal of water and chemicals per municipal regulations." },
      { section: "4. Base Rent and Escalations", page: 5, text: "Year 1: $11.50/sqft NNN (abated month 1 per free rent provision). Year 2: $11.84/sqft. Year 3: $12.19/sqft. Year 4: $12.56/sqft. Year 5: $12.93/sqft. Fixed 3% escalation." },
      { section: "5. Free Rent Concession", page: 6, text: "Landlord grants Tenant one (1) month of free base rent applicable to Month 1. CAM, real estate taxes, and insurance reimbursements remain payable during the free rent month." },
      { section: "6. Tenant Improvement Allowance", page: 8, text: "Landlord shall provide a Tenant Improvement allowance of $8.00 per rentable square foot ($14,400 total) for installation of upgraded floor drain system and water separator required by Tenant's intended use." },
      { section: "7. Maintenance and HVAC", page: 12, text: "Tenant is responsible for routine HVAC maintenance and all plumbing associated with Tenant's water use. Floor drains and separator units to be maintained and inspected annually by licensed contractor at Tenant's expense." },
      { section: "9. Operating Expenses (CAM)", page: 15, text: "Tenant pays pro-rata share (6.75%) of CAM. Due to Tenant's water-intensive use, Tenant's share of utility common area costs is excluded from CAM pool and billed directly via separate metering." },
      { section: "11. Renewal Option", page: 17, text: "Tenant shall have one (1) renewal option of three (3) years at the then-prevailing fair market rent. Tenant must deliver written notice not less than six (6) months prior to expiration of the initial term, time being of the essence." },
      { section: "12. Insurance", page: 18, text: "Tenant shall maintain general liability of $1,000,000 per occurrence and garage keepers legal liability of $500,000. Tenant to maintain environmental liability coverage of $1,000,000 due to chemical use." },
      { section: "22. Special Provisions", page: 26, text: "Tenant granted right of first refusal on any adjacent bay becoming available during the lease term, with 10 business days to exercise." },
    ],
    confidence: {
      tenantName: "high", leaseStart: "high", leaseEnd: "high",
      baseRentSchedule: "high", escalations: "high", camTerms: "medium",
      useClause: "high", tiAllowance: "high", securityDeposit: "high",
      renewalOptions: "high", freeRentMonths: "high", specialProvisions: "low",
    },
  },

  // Negotiated 3: Calder Print - EXPIRES Q4 2026, fixed-escalation renewal
  {
    form: false,
    extractionPath: "vision",
    tenantName: "Calder Print Solutions LLC",
    tenantCategory: "print shop",
    landlordName: "Keystone Capital LLC",
    suite: "208",
    yearsAgo: 5.4,
    termYears: 6,
    rentPerSqft: 12.25,
    sqft: 2600,
    tiAllowance: 15.0,
    freeRentMonths: 3,
    securityDeposit: 7962,
    // Entity-only contact: the lease names the company in Notices but no person,
    // so the person/phone fields stay null (demonstrates the nullable discipline).
    billingContact: { firstName: null, lastName: null, company: "Calder Print Solutions LLC", phone: null, email: "accounts@calderprint.example.com" },
    leaseType: "MG",
    estimatedRecoveryPsf: 3.6,
    operatingExpenseRecovery: null,
    useClause: "Tenant may use the premises for commercial printing, graphic production, and distribution of printed materials.",
    hvacResponsibility: "tenant",
    renewal: { periods: 1, termYears: 5, noticeMonths: 12, rentType: "fixed_escalation", escalationPct: 4.0 },
    sections: [
      { section: "1. Use Clause", page: 3, text: "Tenant may use the premises for commercial printing, graphic production, and distribution of printed materials. Solvents and inks must be stored per fire marshal requirements with secondary containment." },
      { section: "4. Base Rent and Escalations", page: 5, text: "Year 1-3 (months 4-36 after free rent): $12.25/sqft NNN. Year 4: $12.62/sqft. Year 5: $13.00/sqft. Year 6: $13.39/sqft. Rent abated months 1-3." },
      { section: "5. Free Rent Concession", page: 6, text: "Landlord grants Tenant three (3) full months of free base rent applicable to Months 1, 2, and 3 of the initial term to accommodate Tenant's build-out period." },
      { section: "6. Tenant Improvement Allowance", page: 8, text: "Landlord shall provide a Tenant Improvement allowance of $15.00 per rentable square foot ($39,000 total) for build-out of press room, including reinforced flooring rated for 500 lbs/sqft live load. TI disbursed upon receipt of lien waivers and certificate of occupancy." },
      { section: "7. Maintenance and HVAC", page: 12, text: "Tenant is responsible for routine HVAC maintenance. Due to elevated temperature loads from printing equipment, Tenant shall maintain supplemental cooling unit with minimum 3-ton capacity at Tenant's cost." },
      { section: "9. Operating Expenses (CAM)", page: 15, text: "Tenant pays pro-rata share (9.75%) of CAM. Controllable CAM capped at 3% annual increase. Non-controllable CAM (taxes, insurance) passed through without cap." },
      { section: "11. Renewal Option", page: 17, text: "Tenant shall have one (1) renewal option of five (5) years. Base rent during the renewal term shall escalate at four percent (4%) per annum from the rent payable in the final year of the initial term. Notice of exercise: not less than twelve (12) months prior to expiration of the initial term." },
      { section: "16. Default", page: 22, text: "Failure to pay rent within 5 days of due date constitutes default after written notice and 5-day cure. Non-monetary defaults cured within 30 days or such longer period as reasonably necessary provided Tenant commences cure within 30 days." },
      { section: "25. Special Provisions", page: 28, text: "Tenant granted exclusive parking of 8 spaces adjacent to loading dock for duration of lease." },
    ],
    confidence: {
      tenantName: "high", leaseStart: "high", leaseEnd: "high",
      baseRentSchedule: "high", escalations: "high", camTerms: "high",
      useClause: "high", tiAllowance: "medium", securityDeposit: "medium",
      renewalOptions: "high", freeRentMonths: "high", specialProvisions: "high",
    },
  },
];

export function buildLeaseAbstracts(units: Unit[]) {
  const now = new Date();
  const leasedUnits = units.filter((u) => u.tenantName !== null);

  const leases: Array<{
    id: string;
    unitId: string;
    pdfPath: string;
    ingestedAt: Date;
  }> = [];

  const abstracts: Array<{
    id: string;
    leaseId: string;
    tenantName: string;
    landlordName: string;
    propertyAddress: string;
    suite: string;
    leaseStart: Date;
    leaseEnd: Date;
    baseRentSchedule: string;
    escalations: string;
    renewalOptions: string;
    tiAllowance: number | null;
    freeRentMonths: number;
    securityDeposit: number;
    camTerms: string;
    billingContact: string | null;
    estimatedRecoveryPsf: number | null;
    operatingExpenseRecovery: string | null;
    useClause: string;
    specialProvisions: string | null;
    extractionConfidence: string;
    extractionPath: "text" | "vision";
    rawSections: string;
    extractedAt: Date;
    source: string;
    status: string;
  }> = [];

  ABSTRACT_SPECS.forEach((spec, i) => {
    const unit = leasedUnits[i % leasedUnits.length];

    const leaseId = id("lease");
    const abstractId = id("abst");

    const leaseStartDate = new Date(now.getTime() - spec.yearsAgo * 365 * 86_400_000);
    const leaseEndDate = new Date(
      leaseStartDate.getTime() + spec.termYears * 365 * 86_400_000
    );

    const monthlyRent = (spec.rentPerSqft * spec.sqft) / 12;

    const baseRentSchedule = Array.from({ length: spec.termYears }, (_, yr) => ({
      from: new Date(leaseStartDate.getTime() + yr * 365 * 86_400_000).toISOString().slice(0, 10),
      to: new Date(leaseStartDate.getTime() + (yr + 1) * 365 * 86_400_000).toISOString().slice(0, 10),
      monthlyRent: Math.round(monthlyRent * Math.pow(1.03, yr)),
      annualRentPerSqft: Number((spec.rentPerSqft * Math.pow(1.03, yr)).toFixed(2)),
    }));

    const renewalOptionsJson = spec.renewal
      ? JSON.stringify([
          {
            periods: spec.renewal.periods,
            termYears: spec.renewal.termYears,
            noticeMonths: spec.renewal.noticeMonths,
            rentType: spec.renewal.rentType,
            escalationPct: spec.renewal.escalationPct ?? null,
          },
        ])
      : JSON.stringify([]);

    leases.push({
      id: leaseId,
      unitId: unit.id,
      pdfPath: `fixtures/leases/lease_${String(i + 1).padStart(2, "0")}_${spec.tenantName.replace(/\s+/g, "_").toLowerCase()}.pdf`,
      ingestedAt: now,
    });

    abstracts.push({
      id: abstractId,
      leaseId,
      tenantName: spec.tenantName,
      landlordName: spec.landlordName,
      propertyAddress: `${1000 + i * 100} Industrial Blvd, Marisol, TX`,
      suite: spec.suite,
      leaseStart: leaseStartDate,
      leaseEnd: leaseEndDate,
      baseRentSchedule: JSON.stringify(baseRentSchedule),
      escalations: JSON.stringify({ type: "fixed", annualPct: 3.0 }),
      renewalOptions: renewalOptionsJson,
      tiAllowance: spec.tiAllowance,
      freeRentMonths: spec.freeRentMonths,
      securityDeposit: spec.securityDeposit,
      camTerms: JSON.stringify({
        type: spec.leaseType,
        proRataShare: "varies",
        cap: spec.form ? "5% controllable" : "3% controllable",
        reconciliation: "annual",
      }),
      billingContact: JSON.stringify(spec.billingContact),
      estimatedRecoveryPsf: spec.estimatedRecoveryPsf,
      operatingExpenseRecovery: spec.operatingExpenseRecovery
        ? JSON.stringify(spec.operatingExpenseRecovery)
        : null,
      useClause: spec.useClause,
      specialProvisions: spec.form
        ? null
        : JSON.stringify(
            spec.sections
              .filter((s) => s.section.toLowerCase().includes("special"))
              .map((s) => s.text)
          ),
      extractionConfidence: JSON.stringify(spec.confidence),
      extractionPath: spec.extractionPath,
      rawSections: JSON.stringify(spec.sections),
      extractedAt: now,
      source: "seed",
      status: "pushed_to_yardi",
    });
  });

  return { leases, abstracts };
}
