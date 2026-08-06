import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { maxBidCents, lowThresholdCents } from "@/lib/lowbalance";

export const runtime = "nodejs";
const parse = (s: string, d: unknown) => { try { return JSON.parse(s); } catch { return d; } };

// Full customer detail for the admin modal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { id } = await params; // Account id
  const a = await db.account.findUnique({ where: { id }, include: { customer: true } });
  if (!a || !a.customer) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const c = a.customer;
  const [calls, ledger, agg] = await Promise.all([
    db.call.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.ledgerEntry.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.call.aggregate({ where: { customerId: c.id, billed: true }, _count: true, _sum: { chargedCents: true, costCents: true } }),
  ]);
  const bid = maxBidCents(c.bidsJson);
  return NextResponse.json({
    account: { id: a.id, name: `${a.firstName} ${a.lastName}`.trim(), email: a.email, phone: a.phone, city: a.city, state: a.state, zip: a.zip, role: a.role, createdAt: a.createdAt },
    customer: {
      id: c.id, status: c.status, geoType: c.geoType,
      keywords: parse(c.keywords, []), geoStates: parse(c.geoStates, []), hours: parse(c.hours, {}), bids: parse(c.bidsJson, {}),
      routingNumber: c.routingNumber, twilioNumber: c.twilioNumber, areaCode: c.areaCode,
      balanceCents: c.balanceCents, autoTopUp: c.autoTopUp, autoTopUpAmountCents: c.autoTopUpAmountCents,
      lowThresholdCents: lowThresholdCents(c.bidsJson), maxBidCents: bid,
      callsOfHeadroom: bid ? Math.floor(c.balanceCents / bid) : null,
    },
    stats: { billedCalls: agg._count, revenueCents: agg._sum.chargedCents || 0, costCents: agg._sum.costCents || 0 },
    calls: calls.map((x) => ({ id: x.id, from: x.fromNumber, keyword: x.keyword, status: x.status, connectSec: x.connectSec, chargedCents: x.chargedCents, billed: x.billed, at: x.createdAt })),
    ledger: ledger.map((x) => ({ id: x.id, kind: x.kind, amountCents: x.amountCents, balanceAfterCents: x.balanceAfterCents, note: x.note, at: x.createdAt })),
  });
}
