// Rent bands updated 2026-05-27 per the new mock data calibration. Marisol
// office+bath units rent at $20-35/sqft NNN; raw warehouse (no office, no
// bathroom) at $13-20/sqft; expansion markets at $11-18/sqft. The submarket
// row carries both bands; the per-unit seeder picks the right one based on
// whether the unit has Office + Bathroom.

export type Submarket = {
  name: string;
  state: string;
  county: string | null;
  zipCodes: string[];
  isExpansion: boolean;
  rawRentLow: number;         // $/sqft for raw warehouse units (no office, no bath)
  rawRentHigh: number;
  premiumRentLow: number;     // $/sqft for office+bath units (NNN or non-Marisol MG)
  premiumRentHigh: number;
  mgBuiltOutLow: number;      // $/sqft Modified Gross, built-out (office+bath), Marisol only
  mgBuiltOutHigh: number;     // anchored on the Harbor Park One sample rent roll ($27-30/sqft)
  acquisitionBasisPsf: number; // typical all-in acquisition cost per sqft for this submarket
  capexToDemisePsf: number;   // estimated capex to demise / build out a unit in this submarket
};

export const SUBMARKETS: Submarket[] = [
  // Marisol core. Built-out Modified Gross band anchored on the Harbor
  // Park One sample rent roll (Parkhurst county): $27-30/sqft MG.
  { name: "Parkhurst",       state: "TX", county: "Parkhurst",  zipCodes: ["77480", "77405"], isExpansion: false, rawRentLow: 13, rawRentHigh: 20, premiumRentLow: 20, premiumRentHigh: 35, mgBuiltOutLow: 27, mgBuiltOutHigh: 30, acquisitionBasisPsf: 360, capexToDemisePsf: 15 },
  { name: "Calder",          state: "TX", county: "Calder",     zipCodes: ["77301", "77020"], isExpansion: false, rawRentLow: 13, rawRentHigh: 19, premiumRentLow: 22, premiumRentHigh: 34, mgBuiltOutLow: 27, mgBuiltOutHigh: 30, acquisitionBasisPsf: 350, capexToDemisePsf: 15 },
  { name: "Westbrook",  state: "TX", county: "Parkhurst",  zipCodes: ["77401", "77407"], isExpansion: false, rawRentLow: 13, rawRentHigh: 19, premiumRentLow: 21, premiumRentHigh: 33, mgBuiltOutLow: 27, mgBuiltOutHigh: 30, acquisitionBasisPsf: 350, capexToDemisePsf: 15 },
  { name: "Brightwater",       state: "TX", county: "Parkhurst",  zipCodes: ["77431", "77487"], isExpansion: false, rawRentLow: 14, rawRentHigh: 20, premiumRentLow: 24, premiumRentHigh: 35, mgBuiltOutLow: 27, mgBuiltOutHigh: 30, acquisitionBasisPsf: 400, capexToDemisePsf: 12 },
  { name: "Ashby Beach",    state: "TX", county: "Calder",     zipCodes: ["77060", "77064"], isExpansion: false, rawRentLow: 13, rawRentHigh: 18, premiumRentLow: 20, premiumRentHigh: 32, mgBuiltOutLow: 27, mgBuiltOutHigh: 30, acquisitionBasisPsf: 330, capexToDemisePsf: 18 },
  // A secondary in-state market, added 2026-05-31 for the Foundry acquisition (A5).
  // Foundry units carry explicit rents from the bulk-load seed, so these
  // band values just need to be present and plausible for the generator.
  // The mgBuiltOut band models the Olmstead market ($17.50-19.50/sqft MG), which is
  // cheaper than the Marisol core ($27-30). Olmstead is NOT a mirror of Parkhurst.
  { name: "Olmstead",            state: "TX", county: "Merrick",      zipCodes: ["78475", "78471"], isExpansion: false, rawRentLow: 12, rawRentHigh: 18, premiumRentLow: 21, premiumRentHigh: 30, mgBuiltOutLow: 17.5, mgBuiltOutHigh: 19.5, acquisitionBasisPsf: 224.00, capexToDemisePsf: 53.80 },
  // Expansion markets. No built-out MG calibration; mgBuiltOut mirrors the
  // premium band so the picker falls through to premiumRentLow/High instead.
  { name: "Kingsley",     state: "TX", county: "Denholm",       zipCodes: ["76202", "76204"], isExpansion: true,  rawRentLow: 11, rawRentHigh: 15, premiumRentLow: 13, premiumRentHigh: 18, mgBuiltOutLow: 13, mgBuiltOutHigh: 18, acquisitionBasisPsf: 180, capexToDemisePsf: 10 },
  { name: "Orrington",          state: "TX", county: "Orrin",      zipCodes: ["76801", "76805"], isExpansion: true,  rawRentLow: 12, rawRentHigh: 16, premiumRentLow: 14, premiumRentHigh: 18, mgBuiltOutLow: 14, mgBuiltOutHigh: 18, acquisitionBasisPsf: 190, capexToDemisePsf: 10 },
  { name: "Altamont",          state: "NM", county: "Fenwick",      zipCodes: ["87308", "87318"], isExpansion: true,  rawRentLow: 11, rawRentHigh: 15, premiumRentLow: 13, premiumRentHigh: 17, mgBuiltOutLow: 13, mgBuiltOutHigh: 17, acquisitionBasisPsf: 175, capexToDemisePsf: 10 },
];

// Tenant types: small businesses leasing flex industrial space.
// Updated 2026-05-27 to add Auto Design per the KFP sample form lease (an auto
// design shop is the tenant on the sample lease).
export const TENANT_TYPES = [
  "HVAC Contractor",
  "Plumbing Contractor",
  "Electrical Contractor",
  "E-commerce Fulfillment",
  "Light Manufacturing",
  "Distribution",
  "Auto Detailing",
  "Auto Design",
  "Metal Fabrication",
  "Cabinet Shop",
  "Print Shop",
];

export const PROPERTY_NAMES = [
  "Linwood Commerce Park",
  "Sunridge Flex Center",
  "Lake Elmore Logistics Hub",
  "Brightwater Tech Bay",
  "Ashby Bay Park",
  "Westside Industrial Plaza",
  "Riverbend Flex Center",
  "Northpoint Industrial Park",
  "Gulfshore Commerce Park",
];

// Deterministic pseudo-random for reproducible seeds. Same outputs across runs.
export function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function pickRange(rng: () => number, low: number, high: number): number {
  return Math.round(low + (high - low) * rng());
}

export function pickFrom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
