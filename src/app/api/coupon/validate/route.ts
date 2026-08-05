import { NextRequest, NextResponse } from "next/server";
import { validateCoupon, couponEffect } from "@/lib/coupon";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}) as any);
  const v = await validateCoupon(String(b.code || ""));
  if (!v.ok || !v.coupon) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const amount = Math.max(0, Math.round(Number(b.amountCents) || 0));
  const e = couponEffect(v.coupon, amount);
  return NextResponse.json({ ok: true, kind: v.coupon.kind, code: v.coupon.code, ...e });
}
