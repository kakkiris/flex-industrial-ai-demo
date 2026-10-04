// Match-to-available-units for the L1 form-backend qualification flow.
//
// Given a prospect's stated need (size, submarket, lease type) and the current
// vacant inventory, return the units ranked best-first so the leasing team sees
// the strongest matches attached to the enriched lead. The ranking is
// deterministic and rent-independent: vacant seeded units carry rentPerSqft 0
// or null (an empty shell has no in-place rent), so price never enters the
// score. We rank on submarket match first, then on nearest-size proximity, then
// on lease-type match as a final tie-breaker.

import type { AvailableUnit } from "@/lib/prompts/leasing-chat";

export type MatchCriteria = {
  sqft: number | null;
  submarket: string | null;
  leaseType: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// Score is a tuple compared lexicographically: lower is better.
// 1. submarketRank: 0 when the unit is in the requested submarket, else 1.
// 2. sizeDelta: absolute distance from the requested size (0 when no size given
//    so every unit ties on this axis and submarket/lease-type still order them).
// 3. leaseTypeRank: 0 when the lease type matches, else 1.
function scoreOf(unit: AvailableUnit, criteria: MatchCriteria): [number, number, number] {
  const wantSubmarket = normalize(criteria.submarket);
  const submarketRank =
    wantSubmarket && normalize(unit.submarket) === wantSubmarket ? 0 : 1;

  const sizeDelta =
    criteria.sqft != null ? Math.abs(unit.sizeSqft - criteria.sqft) : 0;

  const wantLeaseType = normalize(criteria.leaseType);
  const leaseTypeRank =
    wantLeaseType && normalize(unit.leaseType) === wantLeaseType ? 0 : 1;

  return [submarketRank, sizeDelta, leaseTypeRank];
}

function compareScores(
  a: [number, number, number],
  b: [number, number, number],
): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Rank vacant units against a prospect's stated needs, best match first.
 * Degrades gracefully: returns [] when there is no inventory, and falls back to
 * pure nearest-size ranking when the requested submarket has no available units.
 *
 * @param criteria  the prospect's stated size / submarket / lease type
 * @param vacantUnits the current vacant inventory (rentPerSqft may be 0 / null)
 * @param limit max number of matches to return (default 6)
 */
export function matchUnits(
  criteria: MatchCriteria,
  vacantUnits: AvailableUnit[],
  limit = 6,
): AvailableUnit[] {
  if (vacantUnits.length === 0) return [];

  const ranked = vacantUnits
    .map((unit, index) => ({ unit, index, score: scoreOf(unit, criteria) }))
    .sort((a, b) => {
      const byScore = compareScores(a.score, b.score);
      // Stable tie-break on original order so equal-score units keep a
      // deterministic sequence regardless of the engine's sort stability.
      return byScore !== 0 ? byScore : a.index - b.index;
    })
    .map((entry) => entry.unit);

  return ranked.slice(0, limit);
}
