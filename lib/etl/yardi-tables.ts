import { z } from "zod";

// Six-table Yardi ETL abstraction surface for the A5 (Acquisition Lease
// Bulk-Load) demo. These schemas model the columns the fan-out transform
// actually populates, NOT the full 120/164-column Yardi export headers. The
// column names below follow the standard Yardi Comm* export structure, so
// downstream preview + persistence stays faithful to what an accounting team
// sees in Yardi.
//
// Dates are ISO strings throughout. The upstream caller (C.2/C.3) converts
// Excel serials to ISO before handing the ClosingRentRoll to fanOutToYardiTables;
// this layer emits them as-is.

// ----- Input: ClosingRentRoll -----------------------------------------------

// A single space occupied by, or available for, a tenant. Used both for
// occupied lease units and for vacant unit shells.
export const RentRollUnit = z.object({
  unitCode: z.string().min(1),
  sqft: z.number().positive(),
});
export type RentRollUnit = z.infer<typeof RentRollUnit>;

// A charge line on a lease. For modified-gross leases the codes are "Rent" and
// "EstUtil"; the schema does not hard-restrict the code so other recovery
// charges can flow through unchanged.
export const RentRollCharge = z.object({
  code: z.string().min(1),
  // amount is unbounded: negative values are allowed for credit adjustments.
  amount: z.number(),
});
export type RentRollCharge = z.infer<typeof RentRollCharge>;

// The billing contact who receives invoices for the lease. Names can be blank
// on entity-only leases (company name carries the identity), so the string
// fields are not min(1).
export const RentRollBillingContact = z.object({
  firstName: z.string(),
  lastName: z.string(),
  company: z.string(),
  phone: z.string(),
  email: z.string(),
});
export type RentRollBillingContact = z.infer<typeof RentRollBillingContact>;

// Unpaid leasing costs the seller still owes at closing (TI allowance,
// leasing commission, estimated landlord work). These are carried as a
// closing-credit note on the lease, NOT as a CommLeases column, so the fan-out
// ignores them but the seed loader and later UI can surface them.
export const UnpaidLeasingCosts = z.object({
  tiAllowance: z.number().optional(),
  leasingCommission: z.number().optional(),
  landlordWork: z.number().optional(),
  note: z.string().optional(),
});
export type UnpaidLeasingCosts = z.infer<typeof UnpaidLeasingCosts>;

// One occupied lease, spanning one or more units.
export const RentRollLease = z.object({
  leaseCode: z.string().min(1),
  leaseName: z.string().min(1),
  leaseType: z.string().min(1),
  startDate: z.string(), // ISO date
  endDate: z.string(),   // ISO date
  securityDeposit: z.number(),
  units: z.array(RentRollUnit).min(1),
  charges: z.array(RentRollCharge),
  billingContact: RentRollBillingContact,
  // Optional, additive fields. The fan-out transform does not read these; the
  // seed loader and downstream UI do.
  tenantCategory: z.string().optional(),
  suite: z.string().optional(),
  notes: z.string().optional(),
  unpaidLeasingCosts: UnpaidLeasingCosts.optional(),
});
export type RentRollLease = z.infer<typeof RentRollLease>;

export const RentRollProperty = z.object({
  address1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  // Optional, additive property metadata. Used by the seed loader to populate
  // the properties row and by later A5 UI. The fan-out transform only reads
  // address1/city/state/zip.
  name: z.string().optional(),
  county: z.string().optional(),
  submarket: z.string().optional(),
  totalSf: z.number().optional(),
  purchasePrice: z.number().optional(),
  closingDate: z.string().optional(),
});
export type RentRollProperty = z.infer<typeof RentRollProperty>;

// The full closing rent roll for one property: its occupied leases plus the
// vacant units that become two-table shells.
export const ClosingRentRoll = z.object({
  propertyCode: z.string().min(1),
  property: RentRollProperty,
  leases: z.array(RentRollLease),
  vacantUnits: z.array(RentRollUnit),
});
export type ClosingRentRoll = z.infer<typeof ClosingRentRoll>;

// ----- Output: the six Yardi tables -----------------------------------------

export const CommLeasesRow = z.object({
  Property_Code: z.string(),
  Lease_Code: z.string(),
  Lease_Name: z.string(),
  Lease_Type: z.string(),
  Lease_Start_Date: z.string(),
  Lease_End_Date: z.string(),
  Lease_Move_In_Date: z.string(),
  Contracted_Area: z.number(),
  Security_Deposit: z.number(),
});
export type CommLeasesRow = z.infer<typeof CommLeasesRow>;

export const CommUnitXrefsRow = z.object({
  Property_Code: z.string(),
  Lease_Code: z.string(),
  Unit_Code: z.string(),
  Unit_Start_Date: z.string(),
  Unit_End_Date: z.string(),
  Unit_Move_in_Date: z.string(),
  Status: z.string(),
});
export type CommUnitXrefsRow = z.infer<typeof CommUnitXrefsRow>;

export const CommUnitsRow = z.object({
  Property_Code: z.string(),
  Unit_Code: z.string(),
  Rental_Type: z.string(),
  Address_1: z.string(),
  City: z.string(),
  State: z.string(),
  Zip_Code: z.string(),
  Rent: z.number(),
  SQFT: z.number(),
  Unit_Type: z.string(),
  // Occupied units carry the lease type; vacant shells carry null.
  Lease_Type: z.string().nullable(),
});
export type CommUnitsRow = z.infer<typeof CommUnitsRow>;

export const CommSqftsRow = z.object({
  Property_Code: z.string(),
  Unit_Code: z.string(),
  DTDATE: z.string(),
  DSQFT0: z.number(),
  Notes: z.string(),
});
export type CommSqftsRow = z.infer<typeof CommSqftsRow>;

export const CommChargeSchedulesRow = z.object({
  Property_Code: z.string(),
  Lease_Code: z.string(),
  Charge_Code: z.string(),
  Schedule_From_Date: z.string(),
  Schedule_To_Date: z.string(),
  Amount: z.number(),
  Amount_Period: z.string(),
  Description: z.string(),
});
export type CommChargeSchedulesRow = z.infer<typeof CommChargeSchedulesRow>;

export const CommContactsRow = z.object({
  Contact_Type_Association: z.string(),
  Record_Code: z.string(), // = Lease_Code
  Role_Description: z.string(),
  First_Name: z.string(),
  Last_Name: z.string(),
  Company_Name: z.string(),
  PhoneNumber_1: z.string(),
  Email: z.string(),
});
export type CommContactsRow = z.infer<typeof CommContactsRow>;

// The full six-table output bundle.
export const YardiEtlTables = z.object({
  commLeases: z.array(CommLeasesRow),
  commUnitXrefs: z.array(CommUnitXrefsRow),
  commUnits: z.array(CommUnitsRow),
  commSqfts: z.array(CommSqftsRow),
  commChargeSchedules: z.array(CommChargeSchedulesRow),
  commContacts: z.array(CommContactsRow),
});
export type YardiEtlTables = z.infer<typeof YardiEtlTables>;
