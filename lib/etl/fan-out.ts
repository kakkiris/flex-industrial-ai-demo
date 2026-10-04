import {
  ClosingRentRoll,
  YardiEtlTables,
  type CommLeasesRow,
  type CommUnitXrefsRow,
  type CommUnitsRow,
  type CommSqftsRow,
  type CommChargeSchedulesRow,
  type CommContactsRow,
} from "@/lib/etl/yardi-tables";

// Constants shared across the fan-out. These are demo defaults for the
// modified-gross flex leases KFP acquires; later tasks can parameterize
// them if a dataset needs per-row variation.
const RENTAL_TYPE = "Commercial";
// UNIT_TYPE is a demo placeholder for CommUnits.Unit_Type, intentionally
// distinct from the Yardi billing Rental_Type above.
const UNIT_TYPE = "Commercial";
// NO_DATE is the Yardi sentinel for no effective date on CommSQFTs rows.
const NO_DATE = "";
const AMOUNT_PERIOD = "Monthly";
const BILLING_ROLE = "Billing";
const CONTACT_TYPE_ASSOCIATION = "Lease";
const OCCUPIED_STATUS = "Current";

// fanOutToYardiTables expands one ClosingRentRoll into the six Yardi tables.
//
// Fan-out invariants:
//   OCCUPIED lease ->
//     1 CommLeases (per lease)
//     1 CommUnitXrefs per unit
//     1 CommUnits per unit
//     1 CommSQFTs per unit
//     1 CommChargeSchedules per charge
//     1 Billing CommContacts (per lease)
//   VACANT unit ->
//     1 CommUnits + 1 CommSQFTs ONLY (a shell): no Lease_Code, no Xref,
//     no charge, no contact, and Lease_Type is null.
//
// The transform is pure and deterministic. The input is validated against the
// zod schema on entry and the output is validated on exit, so the schemas are
// load-bearing rather than decorative.
export function fanOutToYardiTables(input: ClosingRentRoll): YardiEtlTables {
  const rr = ClosingRentRoll.parse(input);

  const commLeases: CommLeasesRow[] = [];
  const commUnitXrefs: CommUnitXrefsRow[] = [];
  const commUnits: CommUnitsRow[] = [];
  const commSqfts: CommSqftsRow[] = [];
  const commChargeSchedules: CommChargeSchedulesRow[] = [];
  const commContacts: CommContactsRow[] = [];

  const propertyCode = rr.propertyCode;
  const { address1, city, state, zip } = rr.property;

  for (const lease of rr.leases) {
    // Contracted area is the sum of the lease's unit square footages.
    const contractedArea = lease.units.reduce((sum, u) => sum + u.sqft, 0);

    // 1 CommLeases per lease. The move-in date defaults to the lease start.
    commLeases.push({
      Property_Code: propertyCode,
      Lease_Code: lease.leaseCode,
      Lease_Name: lease.leaseName,
      Lease_Type: lease.leaseType,
      Lease_Start_Date: lease.startDate,
      Lease_End_Date: lease.endDate,
      Lease_Move_In_Date: lease.startDate,
      Contracted_Area: contractedArea,
      Security_Deposit: lease.securityDeposit,
    });

    // The lease's "Rent" charge seeds the per-unit Rent column on CommUnits.
    const rentCharge = lease.charges.find((c) => c.code === "Rent");
    if (!rentCharge) {
      throw new Error(`Occupied lease ${lease.leaseCode} has no Rent charge`);
    }
    const leaseRent = rentCharge.amount;

    for (const unit of lease.units) {
      // 1 CommUnitXrefs per unit.
      commUnitXrefs.push({
        Property_Code: propertyCode,
        Lease_Code: lease.leaseCode,
        Unit_Code: unit.unitCode,
        Unit_Start_Date: lease.startDate,
        Unit_End_Date: lease.endDate,
        Unit_Move_in_Date: lease.startDate,
        Status: OCCUPIED_STATUS,
      });

      // 1 CommUnits per unit, carrying the lease type for occupied units.
      commUnits.push({
        Property_Code: propertyCode,
        Unit_Code: unit.unitCode,
        Rental_Type: RENTAL_TYPE,
        Address_1: address1,
        City: city,
        State: state,
        Zip_Code: zip,
        Rent: leaseRent,
        SQFT: unit.sqft,
        Unit_Type: UNIT_TYPE,
        Lease_Type: lease.leaseType,
      });

      // 1 CommSQFTs per unit.
      commSqfts.push({
        Property_Code: propertyCode,
        Unit_Code: unit.unitCode,
        DTDATE: lease.startDate,
        DSQFT0: unit.sqft,
        Notes: "",
      });
    }

    // 1 CommChargeSchedules per charge.
    for (const charge of lease.charges) {
      commChargeSchedules.push({
        Property_Code: propertyCode,
        Lease_Code: lease.leaseCode,
        Charge_Code: charge.code,
        Schedule_From_Date: lease.startDate,
        Schedule_To_Date: lease.endDate,
        Amount: charge.amount,
        Amount_Period: AMOUNT_PERIOD,
        // Description defaults to charge.code pending a real label map.
        Description: charge.code,
      });
    }

    // 1 Billing CommContacts per lease.
    const c = lease.billingContact;
    commContacts.push({
      Contact_Type_Association: CONTACT_TYPE_ASSOCIATION,
      Record_Code: lease.leaseCode,
      Role_Description: BILLING_ROLE,
      First_Name: c.firstName,
      Last_Name: c.lastName,
      Company_Name: c.company,
      PhoneNumber_1: c.phone,
      Email: c.email,
    });
  }

  // Vacant units become two-table shells: CommUnits + CommSQFTs only.
  for (const unit of rr.vacantUnits) {
    commUnits.push({
      Property_Code: propertyCode,
      Unit_Code: unit.unitCode,
      Rental_Type: RENTAL_TYPE,
      Address_1: address1,
      City: city,
      State: state,
      Zip_Code: zip,
      Rent: 0,
      SQFT: unit.sqft,
      Unit_Type: UNIT_TYPE,
      Lease_Type: null,
    });

    commSqfts.push({
      Property_Code: propertyCode,
      Unit_Code: unit.unitCode,
      DTDATE: NO_DATE,
      DSQFT0: unit.sqft,
      Notes: "Vacant at acquisition",
    });
  }

  return YardiEtlTables.parse({
    commLeases,
    commUnitXrefs,
    commUnits,
    commSqfts,
    commChargeSchedules,
    commContacts,
  });
}
