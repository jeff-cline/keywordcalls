import { db } from "@/lib/db";
import { sendCoreEmail } from "@/lib/core";
import { chargeAutoTopUp } from "@/lib/autotopup";

const BASE = "https://keywordcalls.com";

// A customer's highest active bid (cents) — the most a single call can cost them.
export function maxBidCents(bidsJson: string): number {
  try { const b = JSON.parse(bidsJson) as Record<string, number>; const v = Object.values(b); return v.length ? Math.max(...v) : 0; } catch { return 0; }
}

// "Running low" = fewer than 3 calls of headroom left at their top bid.
export function lowThresholdCents(bidsJson: string): number {
  return maxBidCents(bidsJson) * 3;
}

function lowBalanceEmail(name: string, balanceCents: number, callsLeft: number, autoTopUp: boolean): string {
  const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
  return `<!doctype html><html><body style="margin:0;background:#0b1020;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ee">
    <div style="background:linear-gradient(120deg,#1b2a8f,#2f6bff);padding:22px 24px">
      <div style="color:#fff;font-weight:800;font-size:18px">KeywordCalls 🚀</div>
      <div style="color:#dbe4ff;font-size:13px;margin-top:2px">Your account is running low</div>
    </div>
    <div style="padding:24px;color:#0f1115">
      <p style="font-size:15px;margin:0 0 12px">Hi ${name || "there"},</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 12px">Your KeywordCalls balance is down to <b>${usd(balanceCents)}</b> — that's about <b>${callsLeft} more call${callsLeft === 1 ? "" : "s"}</b> before billing pauses your campaign. Top up now so you don't miss any high-intent calls.</p>
      <p style="font-size:14px;line-height:1.5;color:#475">Your monthly plan fee covers the cost of running your calls; your balance is what pays out per delivered call.</p>
      <a href="${BASE}/dashboard/fund" style="display:inline-block;margin:8px 0 4px;background:linear-gradient(120deg,#1b2a8f,#2f6bff);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;font-size:14px">Top up my account →</a>
      <p style="font-size:13px;color:#667;margin-top:16px">${autoTopUp ? "Auto top-up is ON — we'll add funds automatically once a card is on file." : "Want to never run out? Turn on <b>auto top-up</b> in your dashboard and we'll refill automatically."}</p>
      <p style="font-size:12px;color:#99a;margin-top:18px">Log in anytime at ${BASE}/login</p>
    </div>
  </div></body></html>`;
}

// After a call is billed, warn the customer once when they drop below the 3-call threshold.
// Resets automatically when they top up (fund flow clears lowBalanceNotifiedAt).
export async function checkLowBalance(customerId: string): Promise<void> {
  const c = await db.customer.findUnique({ where: { id: customerId }, include: { account: true } });
  if (!c) return;
  const bid = maxBidCents(c.bidsJson);
  if (bid <= 0) return;
  const threshold = bid * 3;
  if (c.balanceCents >= threshold) return;      // healthy

  // Auto top-up first: charge the saved card and skip the email if it works.
  if (c.autoTopUp && c.stripeCustomerId) {
    const r = await chargeAutoTopUp(customerId);
    if (r.ok) return; // refilled — creditBalance already cleared lowBalanceNotifiedAt
  }

  if (c.lowBalanceNotifiedAt) return;           // already warned this cycle
  const callsLeft = Math.max(0, Math.floor(c.balanceCents / bid));
  await db.customer.update({ where: { id: customerId }, data: { lowBalanceNotifiedAt: new Date() } });
  await sendCoreEmail(c.account.email, "Your KeywordCalls account is running low", lowBalanceEmail(c.account.firstName, c.balanceCents, callsLeft, c.autoTopUp), "low_balance");
}
