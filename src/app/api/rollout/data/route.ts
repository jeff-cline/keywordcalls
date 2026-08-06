import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { jdiOverview } from "@/lib/jdi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real-time rollout data for the God console: batches, delivery, callbacks (time-series + append).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const campaignId = new URL(req.url).searchParams.get("campaignId") || "";
  const c = campaignId
    ? await db.outreachCampaign.findUnique({ where: { id: campaignId } })
    : await db.outreachCampaign.findFirst({ orderBy: { createdAt: "asc" } });
  if (!c) return NextResponse.json({ ok: true, campaign: null });

  const [batches, callbacks, listCount] = await Promise.all([
    db.rolloutBatch.findMany({ where: { campaignId: c.id }, orderBy: { launchedAt: "asc" } }),
    db.campaignCallback.findMany({ where: { campaignId: c.id }, orderBy: { at: "asc" }, take: 2000 }),
    c.listId ? db.listContact.count({ where: { listId: c.listId } }) : Promise.resolve(0),
  ]);

  // Live delivered/filtered across this campaign's rollout batches (best-effort).
  let delivered = 0, filtered = 0;
  for (const b of batches) { if (b.jdiCampaignId) { const ov = await jdiOverview(b.jdiCampaignId); if (ov) { delivered += Number(ov.delivered || 0); filtered += Number(ov.filtered || 0); } } }

  const sent = batches.reduce((a, b) => a + b.size, 0);
  return NextResponse.json({
    ok: true,
    campaign: { id: c.id, name: c.name, hasAudio: !!c.outboundAudioUrl, campaignNumber: c.campaignNumber, listCount, sentTotal: sent, remaining: Math.max(0, listCount - sent) },
    delivered, filtered,
    batches: batches.map((b) => ({ id: b.id, label: b.label, size: b.size, throttle: b.throttle, launchedAt: b.launchedAt })),
    callbacks: callbacks.map((cb) => ({ phone: cb.phone, name: cb.name, email: cb.email, city: cb.city, state: cb.state, at: cb.at })),
  });
}
