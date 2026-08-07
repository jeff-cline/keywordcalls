import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { jdiPause, jdiResume, jdiOverview } from "@/lib/jdi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pause or resume a whole rollout campaign — holds every one of its active JDI batches (the queued
// numbers wait) until you unpause. God only, per campaign.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { campaignId?: string; action?: string };
  const campaignId = String(b.campaignId || "");
  const resume = b.action === "resume";

  const c = await db.outreachCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const batches = await db.rolloutBatch.findMany({ where: { campaignId } });
  let affected = 0;
  for (const batch of batches) {
    if (!batch.jdiCampaignId) continue;
    // Only act on batches in the opposite state (skip completed/stopped — JDI 409s those).
    const ov = await jdiOverview(batch.jdiCampaignId);
    const status = String(ov?.status || "").toUpperCase();
    if (resume) { if (status === "PAUSED") { const r = await jdiResume(batch.jdiCampaignId); if (r.ok) affected++; } }
    else { if (status === "ACTIVE") { const r = await jdiPause(batch.jdiCampaignId); if (r.ok) affected++; } }
  }

  await db.outreachCampaign.update({ where: { id: campaignId }, data: { paused: !resume } });
  return NextResponse.json({ ok: true, paused: !resume, affected });
}
