import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Customer sets what they'll pay per call for each keyword (dollars in → cents stored).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const customer = await db.customer.findUnique({ where: { accountId: s.uid } });
  if (!customer) return NextResponse.json({ error: "No campaign found." }, { status: 400 });

  const { bids } = (await req.json().catch(() => ({}))) as { bids?: Record<string, unknown> };
  const cents: Record<string, number> = {};
  for (const [k, v] of Object.entries(bids || {})) {
    const n = Math.round(parseFloat(String(v)) * 100);
    if (n > 0) cents[k] = n;
  }
  await db.customer.update({ where: { id: customer.id }, data: { bidsJson: JSON.stringify(cents) } });
  return NextResponse.json({ ok: true, bids: cents });
}
