// Coverage priority: when two customers bid the SAME amount on a keyword,
// the wider footprint wins the call. National > Regional > Statewide > Local.
export const SCOPE_RANK: Record<string, number> = { national: 4, regional: 3, statewide: 2, local: 1 };
export const scopeRank = (geoType: string): number => SCOPE_RANK[geoType] ?? 0;
export const scopeLabel = (geoType: string): string => ({ national: "National", regional: "Regional", statewide: "Statewide", local: "Local" }[geoType] || geoType);

// Rank competing bidders for one keyword: highest bid first, then widest coverage.
export function rankBidders<T extends { bidCents: number; geoType: string }>(a: T, b: T): number {
  return b.bidCents - a.bidCents || scopeRank(b.geoType) - scopeRank(a.geoType);
}

// One line of plain-English copy customers see explaining the tiebreaker.
export const PRIORITY_COPY =
  "Your monthly plan fee covers the cost of running your calls. When more than one advertiser bids the same amount on a keyword, wider coverage wins the call: National beats Regional, Regional beats Statewide, and Statewide beats Local. Bid higher to move to the front regardless of coverage.";
