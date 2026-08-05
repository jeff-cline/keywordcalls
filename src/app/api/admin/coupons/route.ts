import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";

async function guard() {
  const s = await getSession();
  return isGod(s) ? null : NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ coupons: await db.coupon.findMany({ orderBy: { createdAt: "desc" } }) });
}

// action: create | update | delete
export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}) as any);
  const action = String(b.action || "create");

  if (action === "delete") {
    if (b.id) await db.coupon.delete({ where: { id: String(b.id) } }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const kind = b.kind === "add_funds" ? "add_funds" : "percent";
  const code = String(b.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const value = kind === "percent"
    ? Math.min(100, Math.max(0, Math.round(Number(b.value) || 0)))
    : Math.max(0, Math.round((Number(b.value) || 0) * 100)); // add_funds: dollars → cents
  const data = {
    kind, value,
    active: b.active !== false,
    maxRedemptions: Math.max(0, Math.round(Number(b.maxRedemptions) || 0)),
    note: String(b.note || "").slice(0, 200),
  };

  if (action === "update") {
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.coupon.update({ where: { id: String(b.id) }, data }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (!code) return NextResponse.json({ error: "Enter a code." }, { status: 400 });
  if (await db.coupon.findUnique({ where: { code } })) return NextResponse.json({ error: "That code already exists." }, { status: 400 });
  const c = await db.coupon.create({ data: { code, ...data } });
  return NextResponse.json({ ok: true, id: c.id });
}
