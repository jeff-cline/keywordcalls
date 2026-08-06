import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { creditBalance } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe posts here when a checkout completes → credit the customer's balance (idempotent).
export async function POST(req: NextRequest) {
  const stripe = await getStripe();
  const whSecret = await getSetting("stripeWebhookSecret");
  if (!stripe) return NextResponse.json({ ok: false }, { status: 400 });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let event: any;
  try {
    event = whSecret ? stripe.webhooks.constructEvent(raw, sig, whSecret) : JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as { id: string; metadata?: Record<string, string>; amount_total?: number; customer?: string };
    const customerId = s.metadata?.customerId || "";
    const creditCents = parseInt(s.metadata?.creditCents || "0", 10) || (s.amount_total || 0);
    const couponCode = s.metadata?.couponCode || "";
    if (customerId && creditCents > 0) {
      const { already } = await creditBalance(customerId, creditCents, "fund", `Stripe funding${couponCode ? ` (coupon ${couponCode})` : ""}`, s.id);
      if (!already && couponCode) await db.coupon.updateMany({ where: { code: couponCode }, data: { redeemed: { increment: 1 } } }).catch(() => {});
    }
    // Remember the Stripe customer so we can charge the saved card for auto-top-up.
    if (customerId && s.customer) await db.customer.update({ where: { id: customerId }, data: { stripeCustomerId: String(s.customer) } }).catch(() => {});
  }
  return NextResponse.json({ received: true });
}
