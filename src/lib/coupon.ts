import { db } from "@/lib/db";

export type Coupon = { id: string; code: string; kind: string; value: number; active: boolean; maxRedemptions: number; redeemed: number; expiresAt: Date | null };

export async function validateCoupon(codeRaw: string): Promise<{ ok: boolean; coupon?: Coupon; error?: string }> {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };
  const c = await db.coupon.findUnique({ where: { code } }).catch(() => null);
  if (!c || !c.active) return { ok: false, error: "Invalid or inactive code." };
  if (c.expiresAt && c.expiresAt < new Date()) return { ok: false, error: "This code has expired." };
  if (c.maxRedemptions > 0 && c.redeemed >= c.maxRedemptions) return { ok: false, error: "This code has been fully redeemed." };
  return { ok: true, coupon: c as Coupon };
}

// Effect of a coupon on a chosen funding amount.
// percent  → discount on what they PAY; balance credited = the full chosen amount.
// add_funds→ free funds added to the balance (no payment needed).
export function couponEffect(coupon: { kind: string; value: number }, amountCents: number): { chargeCents: number; creditCents: number; desc: string } {
  if (coupon.kind === "percent") {
    const pct = Math.min(100, Math.max(0, coupon.value));
    return { chargeCents: Math.round(amountCents * (1 - pct / 100)), creditCents: amountCents, desc: `${pct}% off` };
  }
  return { chargeCents: 0, creditCents: coupon.value, desc: `$${(coupon.value / 100).toLocaleString("en-US")} free funds` };
}
