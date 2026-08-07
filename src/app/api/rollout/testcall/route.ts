import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { coreCall } from "@/lib/core";
import { e164 } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// God: ring a tester's phone and run them through the real callback path (dials the buyer routing
// number) so they can confirm the buyer answers — and talk to them.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { to?: string; campaignId?: string };
  const to = e164(String(b.to || ""));
  if (to.replace(/\D/g, "").length < 11) return NextResponse.json({ error: "Enter a valid 10-digit US number to ring." }, { status: 400 });

  const c = b.campaignId ? await db.outreachCampaign.findUnique({ where: { id: b.campaignId } }) : await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } });
  if (!c) return NextResponse.json({ error: "No campaign found." }, { status: 404 });
  if (!c.routingNumber) return NextResponse.json({ error: "No buyer routing number is set." }, { status: 400 });

  const twimlUrl = `https://keywordcalls.com/api/rollout/test-twiml?c=${encodeURIComponent(c.id)}`;
  const r = await coreCall(to, { twimlUrl });
  if (!r.ok) return NextResponse.json({ error: r.error || "Could not place the test call." }, { status: 502 });
  return NextResponse.json({ ok: true, to, routingNumber: c.routingNumber });
}
