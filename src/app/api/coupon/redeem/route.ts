import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupon";
import { creditBalance } from "@/lib/money";

// Redeem an "add_funds" coupon → free balance credit (no payment). For tester/comp accounts.
export async function POST(req: NextRequest) {
  const acct = await currentAccount();
  if (!acct) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const customer = await db.customer.findUnique({ where: { accountId: acct.id } });
  if (!customer) return NextResponse.json({ error: "No customer account." }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const v = await validateCoupon(String(b.code || ""));
  if (!v.ok || !v.coupon) return NextResponse.json({ error: v.error }, { status: 400 });
  if (v.coupon.kind !== "add_funds") return NextResponse.json({ error: "This code applies as a discount at checkout, not a direct credit." }, { status: 400 });

  const ref = `coupon:${v.coupon.code}:${customer.id}`;
  const { already, balance } = await creditBalance(customer.id, v.coupon.value, "coupon", `Coupon ${v.coupon.code}`, ref);
  if (already) return NextResponse.json({ error: "You've already redeemed this code." }, { status: 400 });
  await db.coupon.update({ where: { id: v.coupon.id }, data: { redeemed: { increment: 1 } } }).catch(() => {});
  return NextResponse.json({ ok: true, balance });
}
