// Shared availability shape for the L1 form-backend qualification flow. The
// conversational chat widget was retired (29-May client feedback). Only the
// AvailableUnit type is retained; lib/match-units.ts imports it to type the
// vacant inventory the matcher ranks against a prospect's stated need.
export type AvailableUnit = {
  propertyName: string;
  submarket: string;
  suite: string;
  sizeSqft: number;
  rentPerSqft: number;
  leaseType: string;
};
