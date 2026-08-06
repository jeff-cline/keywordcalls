import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { jdiOverview } from "@/lib/jdi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CAP_PER_HOUR = 18000; // JDI account capacity (portal "Max/hr")

// Real-time rollout data for the God console. Supports A/B/C/D lead-set tabs + "All Combined".
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const u = new URL(req.url);
  const campaignId = u.searchParams.get("campaignId") || "";
  const combined = u.searchParams.get("combined") === "1";
  const afterhours = u.searchParams.get("afterhours") === "1";

  // After Hours Callback view: everyone who called back but didn't reach an agent (after-hours or
  // the center didn't answer), plus whether the 10am recovery re-drop has gone out.
  if (afterhours) {
    const template = (await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } })) || (await db.outreachCampaign.findFirst({ orderBy: { createdAt: "asc" } }));
    const [missed, pending, recovered] = await Promise.all([
      db.campaignCallback.findMany({ where: { outcome: { in: ["after_hours", "no_answer"] } }, orderBy: { at: "desc" }, take: 500 }),
      db.campaignCallback.count({ where: { outcome: { in: ["after_hours", "no_answer"] }, redropped: false } }),
      db.campaignCallback.count({ where: { redropped: true } }),
    ]);
    return NextResponse.json({
      ok: true, afterhours: true,
      template: template ? { id: template.id, name: template.name, hasAfterHoursAudio: !!template.afterHoursAudioUrl } : null,
      summary: { missed: missed.length, pending, recovered },
      rows: missed.map((m) => ({ phone: m.phone, name: m.name, email: m.email, city: m.city, state: m.state, outcome: m.outcome, redropped: m.redropped, redroppedAt: m.redroppedAt, at: m.at })),
    });
  }

  // Tabs: all tagged rollout campaigns; fall back to the first campaign as group "A".
  let tests = await db.outreachCampaign.findMany({ where: { rolloutGroup: { not: "" } }, orderBy: { rolloutGroup: "asc" }, select: { id: true, name: true, rolloutGroup: true } });
  if (tests.length === 0) { const f = await db.outreachCampaign.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }); if (f) tests = [{ id: f.id, name: f.name, rolloutGroup: "A" }]; }

  // Which campaign(s) to report on.
  let camps;
  if (combined) camps = await db.outreachCampaign.findMany({ where: { id: { in: tests.map((t) => t.id) } } });
  else { const c = campaignId ? await db.outreachCampaign.findUnique({ where: { id: campaignId } }) : await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } }) || await db.outreachCampaign.findFirst({ orderBy: { createdAt: "asc" } }); camps = c ? [c] : []; }
  if (!camps.length) return NextResponse.json({ ok: true, campaign: null, tests, cap: { maxPerHour: CAP_PER_HOUR } });

  const ids = camps.map((c) => c.id);
  const [batches, green, recent, callbacks, calledBackCount, billableCount, sentCount] = await Promise.all([
    db.rolloutBatch.findMany({ where: { campaignId: { in: ids } }, orderBy: { launchedAt: "asc" } }),
    db.rolloutTarget.findMany({ where: { campaignId: { in: ids }, calledBack: true }, orderBy: { calledBackAt: "desc" }, take: 500 }),
    db.rolloutTarget.findMany({ where: { campaignId: { in: ids }, calledBack: false }, orderBy: { at: "desc" }, take: 300 }),
    db.campaignCallback.findMany({ where: { campaignId: { in: ids } }, orderBy: { at: "asc" }, take: 2000 }),
    db.rolloutTarget.count({ where: { campaignId: { in: ids }, calledBack: true } }),
    db.rolloutTarget.count({ where: { campaignId: { in: ids }, billable: true } }),
    db.rolloutTarget.count({ where: { campaignId: { in: ids } } }),
  ]);
  const listCounts = await Promise.all(camps.map((c) => c.listId ? db.listContact.count({ where: { listId: c.listId } }) : Promise.resolve(0)));
  const totalList = listCounts.reduce((a, b) => a + b, 0);

  const targets = [...green, ...recent].map((t) => ({ phone: t.phone, name: t.name, email: t.email, city: t.city, state: t.state, calledBack: t.calledBack, calledBackAt: t.calledBackAt, landedAt: t.landedAt, connectSec: t.connectSec, billable: t.billable, sentAt: t.at }));

  // Live delivery funnel across all batches (best-effort, from JDI).
  let delivered = 0, filtered = 0, loaded = 0, undelivered = 0, inQueue = 0, processing = false;
  for (const b of batches) { if (b.jdiCampaignId) { const ov = await jdiOverview(b.jdiCampaignId); if (ov) { delivered += Number(ov.delivered || 0); filtered += Number(ov.filtered || 0); loaded += Number(ov.numbersLoaded || 0); undelivered += Number(ov.undelivered || 0); inQueue += Number(ov.hopperCount || 0); if (String(ov.status || "").toUpperCase() === "ACTIVE") processing = true; } } }

  const sent = batches.reduce((a, b) => a + b.size, 0);
  const one = camps[0];
  const campaign = combined
    ? { id: "", name: "All Combined", hasAudio: false, campaignNumber: "", routingNumber: "combined", listCount: totalList, sentTotal: sent, remaining: Math.max(0, totalList - sent), combined: true }
    : { id: one.id, name: one.name, hasAudio: !!one.outboundAudioUrl, campaignNumber: one.campaignNumber, routingNumber: one.routingNumber, listCount: totalList, sentTotal: sent, remaining: Math.max(0, totalList - sent), combined: false };

  return NextResponse.json({
    ok: true, campaign, tests, cap: { maxPerHour: CAP_PER_HOUR },
    delivered, filtered, loaded, undelivered, inQueue, processing, sentCount, calledBackCount, billableCount,
    batches: batches.map((b) => ({ id: b.id, label: b.label, size: b.size, throttle: b.throttle, launchedAt: b.launchedAt })),
    targets,
    callbacks: callbacks.map((cb) => ({ phone: cb.phone, name: cb.name, email: cb.email, city: cb.city, state: cb.state, landedAt: cb.landedAt, connectSec: cb.connectSec, billable: cb.billable, at: cb.at })),
  });
}
