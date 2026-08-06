import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { validateCoupon, couponEffect } from "@/lib/coupon";

// Create a Stripe Checkout session to fund the pre-paid balance (percent coupons discount the charge).
export async function POST(req: NextRequest) {
  const acct = await currentAccount();
  if (!acct) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const customer = await db.customer.findUnique({ where: { accountId: acct.id } });
  if (!customer) return NextResponse.json({ error: "No customer account." }, { status: 400 });

  const stripe = await getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing isn't set up yet — check back shortly." }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const minFund = parseInt(await getSetting("minFundCents", "50000"), 10);
  const amount = Math.round(Number(b.amountCents) || 0);
  if (amount < minFund) return NextResponse.json({ error: `Minimum funding is $${(minFund / 100).toLocaleString("en-US")}.` }, { status: 400 });

  let chargeCents = amount, creditCents = amount, couponCode = "";
  if (b.couponCode) {
    const v = await validateCoupon(String(b.couponCode));
    if (v.ok && v.coupon && v.coupon.kind === "percent") { const e = couponEffect(v.coupon, amount); chargeCents = e.chargeCents; creditCents = e.creditCents; couponCode = v.coupon.code; }
  }
  if (chargeCents < 50) return NextResponse.json({ error: "Charge amount is too small." }, { status: 400 });

  const origin = req.headers.get("origin") || "https://keywordcalls.com";
  // Save the card so we can auto-top-up off-session later. Reuse the Stripe customer if we have one.
  const customerOpts: Record<string, unknown> = customer.stripeCustomerId
    ? { customer: customer.stripeCustomerId }
    : { customer_creation: "always", customer_email: acct.email };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", product_data: { name: "KeywordCalls account funding" }, unit_amount: chargeCents }, quantity: 1 }],
    payment_intent_data: { setup_future_usage: "off_session" },
    metadata: { customerId: customer.id, creditCents: String(creditCents), couponCode },
    success_url: `${origin}/dashboard?funded=1`,
    cancel_url: `${origin}/dashboard/fund?canceled=1`,
    ...customerOpts,
  } as Parameters<typeof stripe.checkout.sessions.create>[0]);
  return NextResponse.json({ url: session.url });
}
