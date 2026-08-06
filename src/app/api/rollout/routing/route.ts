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
  // A/B/C/D rollout tests share the callback routing — set it on every rollout group at once.
  const target = await db.outreachCampaign.findUnique({ where: { id: String(campaignId || "") }, select: { rolloutGroup: true } });
  if (target?.rolloutGroup) await db.outreachCampaign.updateMany({ where: { rolloutGroup: { not: "" } }, data: { routingNumber: norm } });
  else await db.outreachCampaign.update({ where: { id: String(campaignId || "") }, data: { routingNumber: norm } });
  return NextResponse.json({ ok: true, number: norm });
}
