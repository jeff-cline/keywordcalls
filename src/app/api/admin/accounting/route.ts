import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff, isGod } from "@/lib/auth";
import { setSetting, getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { computeAccounting } from "@/lib/accounting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json(await computeAccounting());
}

// Save the JDI credit balance you read off the portal (+ cents per credit) so remaining can be tracked.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { balance?: unknown; centsPerCredit?: unknown };
  if (b.balance !== undefined) {
    const bal = Math.max(0, parseInt(String(b.balance), 10) || 0);
    // snapshot the delivered count now so "remaining" counts drops since this entry
    const delivered = (await db.outreachCampaign.aggregate({ _sum: { deliveredCount: true } }))._sum.deliveredCount || 0;
    await setSetting("jdiCreditBalance", String(bal));
    await setSetting("jdiCreditBalanceAt", String(delivered));
  }
  if (b.centsPerCredit !== undefined) await setSetting("jdiCentsPerCredit", String(parseFloat(String(b.centsPerCredit)) || 2));
  const st = await getSettings(["jdiCreditBalance", "jdiCentsPerCredit"]);
  return NextResponse.json({ ok: true, ...st });
}
