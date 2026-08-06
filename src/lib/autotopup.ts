import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { creditBalance } from "@/lib/money";

// Charge the customer's saved card off-session and credit their balance.
// Returns { ok, error }. ok=false means we couldn't charge (no card / declined / needs auth).
export async function chargeAutoTopUp(customerId: string): Promise<{ ok: boolean; error?: string }> {
  const c = await db.customer.findUnique({ where: { id: customerId } });
  if (!c) return { ok: false, error: "no customer" };
  if (!c.autoTopUp) return { ok: false, error: "auto top-up off" };
  if (!c.stripeCustomerId) return { ok: false, error: "no saved card" };
  const amount = c.autoTopUpAmountCents;
  if (amount < 100) return { ok: false, error: "amount not set" };

  const stripe = await getStripe();
  if (!stripe) return { ok: false, error: "billing not configured" };

  try {
    // Prefer the invoice-settings default PM, else the most recent saved card.
    const sc = await stripe.customers.retrieve(c.stripeCustomerId);
    let pm = (sc && !("deleted" in sc) ? (sc.invoice_settings?.default_payment_method as string | null) : null) || null;
    if (!pm) { const pms = await stripe.paymentMethods.list({ customer: c.stripeCustomerId, type: "card", limit: 1 }); pm = pms.data[0]?.id || null; }
    if (!pm) return { ok: false, error: "no card on file" };

    const pi = await stripe.paymentIntents.create({
      amount, currency: "usd", customer: c.stripeCustomerId, payment_method: pm,
      off_session: true, confirm: true,
      description: "KeywordCalls auto top-up",
      metadata: { customerId, kind: "auto_topup" },
    });
    if (pi.status === "succeeded") {
      await creditBalance(customerId, amount, "fund", "Auto top-up (saved card)", pi.id);
      return { ok: true };
    }
    return { ok: false, error: `payment ${pi.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "charge failed" };
  }
}
