import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { e164 } from "@/lib/twilio";
export const runtime = "nodejs";
// God: set where a campaign's callbacks route (the owner / call center). Stored in E.164.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { campaignId, number } = (await req.json().catch(() => ({}))) as { campaignId?: string; number?: unknown };
  const norm = e164(String(number || ""));
  if (norm.replace(/\D/g, "").length < 11) return NextResponse.json({ error: "Enter a valid 10-digit US number." }, { status: 400 });
  await db.outreachCampaign.update({ where: { id: String(campaignId || "") }, data: { routingNumber: norm } });
  return NextResponse.json({ ok: true, number: norm });
}
