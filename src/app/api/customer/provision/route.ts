import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { activateCustomer } from "@/lib/activate";

export const runtime = "nodejs";

// Customer self-serve: go live — buys an area-code-matched tracking number once funded.
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const customer = await db.customer.findUnique({ where: { accountId: s.uid } });
  if (!customer) return NextResponse.json({ error: "No campaign found." }, { status: 400 });
  if (customer.twilioNumber) return NextResponse.json({ ok: true, number: customer.twilioNumber });

  const minFund = parseInt(await getSetting("minFundCents", "50000"), 10);
  if (customer.balanceCents < minFund) return NextResponse.json({ error: `Add at least $${(minFund / 100).toFixed(0)} to go live.` }, { status: 400 });
  if (!customer.routingNumber) return NextResponse.json({ error: "Set your routing number first." }, { status: 400 });

  const r = await activateCustomer(customer.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, number: r.number });
}
