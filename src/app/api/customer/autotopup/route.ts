import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Customer sets their auto-top-up preference (charges a saved card once one is on file).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const customer = await db.customer.findUnique({ where: { accountId: s.uid } });
  if (!customer) return NextResponse.json({ error: "No campaign found." }, { status: 400 });
  const { enabled, amountDollars } = (await req.json().catch(() => ({}))) as { enabled?: boolean; amountDollars?: unknown };
  const amountCents = Math.max(0, Math.round(parseFloat(String(amountDollars ?? "")) * 100) || 0);
  await db.customer.update({ where: { id: customer.id }, data: { autoTopUp: !!enabled, ...(amountCents ? { autoTopUpAmountCents: amountCents } : {}) } });
  return NextResponse.json({ ok: true });
}
