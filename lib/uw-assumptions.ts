import { SUBMARKETS } from "@/db/seed/_data";

export type UwAssumptions = {
  marketRentPsf: number;
  marketRentLow: number;
  marketRentHigh: number;
  acquisitionBasisPsf: number;
  rentGrowthPct: number;
  noiMargin: number;       // in-place NOI as a fraction of in-place contract rent (MG recoveries offset opex)
  vacancyPct: number;      // stabilized vacancy
  reservesPsf: number;
  acqCostPct: number;
  capexToDemisePsf: number;
  exitCapPct: number;
};

const GLOBAL = {
  noiMargin: 1.0,
  vacancyPct: 0.05,
  reservesPsf: 0.25,
  acqCostPct: 0.015,
  exitCapPct: 0.07,
};

// Foundry (Olmstead) deal inputs. Outputs are NOT hard-coded; underwriteProperty
// computes them. With basis 224.00 and in-place ~17.65, going-in cap computes ~7.7%.
export const FOUNDRY_UW: UwAssumptions = {
  marketRentPsf: 19.5, marketRentLow: 18.5, marketRentHigh: 24,
  acquisitionBasisPsf: 224.00, rentGrowthPct: 0.05,
  capexToDemisePsf: 53.80, ...GLOBAL,
};

// The three sample OMs sit in submarkets that are not seeded in SUBMARKETS, so a
// direct lookup misses and the unknown-submarket fallback sets market = the
// unit's own rent (performanceToUw = 0 for every OM unit). Map each OM submarket
// to its nearest KNOWN seeded submarket by geography so the OM units underwrite
// against a calibrated market band instead of flat 0% upside. No new bands
// are invented; these reuse existing calibrated rows.
//   - "Paloma" (Gateway Commerce Center, Madrone/Gulf Coast TX) -> "Olmstead" (the only seeded non-Marisol core row).
//   - "Riverside District" (Riverside Flex Portfolio, Calder) -> "Calder".
//   - "North Calder Industrial" (Northgate Industrial, Calder) -> "Calder".
const OM_SUBMARKET_ALIASES: Record<string, string> = {
  Paloma: "Olmstead",
  "Riverside District": "Calder",
  "North Calder Industrial": "Calder",
};

export function getUwAssumptions(
  submarket: string,
  opts: { isBuiltOut: boolean; isExpansion: boolean; fallbackRentPsf?: number },
): UwAssumptions {
  const aliased = OM_SUBMARKET_ALIASES[submarket] ?? submarket;
  const sm = SUBMARKETS.find((s) => s.name === aliased);
  if (!sm) {
    const market = opts.fallbackRentPsf ?? 16;
    return {
      marketRentPsf: market, marketRentLow: market * 0.9, marketRentHigh: market * 1.2,
      acquisitionBasisPsf: 180, rentGrowthPct: 0.04, capexToDemisePsf: 12, ...GLOBAL,
    };
  }
  const [low, high] =
    opts.isBuiltOut && !opts.isExpansion ? [sm.mgBuiltOutLow, sm.mgBuiltOutHigh]
    : opts.isBuiltOut ? [sm.premiumRentLow, sm.premiumRentHigh]
    : [sm.rawRentLow, sm.rawRentHigh];
  return {
    marketRentPsf: Number(((low + high) / 2).toFixed(2)),
    marketRentLow: low, marketRentHigh: high,
    acquisitionBasisPsf: sm.acquisitionBasisPsf,
    rentGrowthPct: sm.isExpansion ? 0.035 : 0.05,
    capexToDemisePsf: sm.capexToDemisePsf,
    ...GLOBAL,
  };
}
