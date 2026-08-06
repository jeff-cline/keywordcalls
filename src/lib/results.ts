// The results model shown on the results page + PDF. Example the user specified:
// 10 estimated calls, 1 sale → LTV created; cost = 10 × $75/call = $750; ROAS = LTV ÷ 750.
export function resultsFor(ltvCents: number) {
  const calls = 10;
  const pricePerCallCents = 7500; // $75 per delivered call
  const costCents = calls * pricePerCallCents; // $750
  const revenueCents = ltvCents; // one sale creates the full lifetime value
  const roas = costCents > 0 ? revenueCents / costCents : 0;
  return { calls, pricePerCallCents, costCents, revenueCents, roas };
}
export const usd = (c: number) => "$" + Math.round(c / 100).toLocaleString("en-US");
