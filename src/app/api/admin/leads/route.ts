import { NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Two lead pools for /admin/leads:
//  • business  — everyone we're reaching out to (the uploaded prospect lists)
//  • consumer  — the high-intent people who actually called back AND connected (with revenue)
export async function GET() {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const [total, lists, sample, campaigns, connected] = await Promise.all([
    db.listContact.count(),
    db.callList.findMany({ orderBy: { createdAt: "desc" }, select: { name: true, rowCount: true } }),
    db.listContact.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { firstName: true, lastName: true, phone: true, email: true, city: true, state: true } }),
    db.outreachCampaign.findMany({ select: { id: true, bidCents: true } }),
    db.campaignCallback.findMany({ where: { connectSec: { gt: 0 } }, orderBy: { at: "desc" }, take: 500 }),
  ]);
  const bid = new Map(campaigns.map((c) => [c.id, c.bidCents]));

  const consumerRows = connected.map((c) => {
    const revenueCents = c.billable ? (bid.get(c.campaignId) || 0) : 0;
    return { name: c.name, phone: c.phone, email: c.email, city: c.city, state: c.state, connectSec: c.connectSec, billable: c.billable, revenueCents, at: c.at };
  });
  const consumerRevenueCents = consumerRows.reduce((a, r) => a + r.revenueCents, 0);

  return NextResponse.json({
    ok: true,
    business: { total, lists, sample: sample.map((x) => ({ name: `${x.firstName} ${x.lastName}`.trim(), phone: x.phone, email: x.email, city: x.city, state: x.state })) },
    consumer: { count: consumerRows.length, revenueCents: consumerRevenueCents, rows: consumerRows },
  });
}
