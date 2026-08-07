import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { jdiOverview } from "@/lib/jdi";
import { campaignOpen, nextWindowOpen } from "@/lib/outreach";

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
    // "Missed" = the buyer was never reached (connectSec 0), regardless of how it ended. This catches
    // every non-connected callback — after-hours, no-answer, no-route, or ones Twilio never resolved.
    const [rows, missed, pending, recovered] = await Promise.all([
      db.campaignCallback.findMany({ where: { connectSec: 0 }, orderBy: { at: "desc" }, take: 500 }),
      db.campaignCallback.count({ where: { connectSec: 0 } }),
      db.campaignCallback.count({ where: { connectSec: 0, redropped: false } }),
      db.campaignCallback.count({ where: { redropped: true } }),
    ]);
    return NextResponse.json({
      ok: true, afterhours: true,
      template: template ? { id: template.id, name: template.name, hasAfterHoursAudio: !!template.afterHoursAudioUrl, afterHoursAudioUrl: template.afterHoursAudioUrl } : null,
      summary: { missed, pending, recovered },
      rows: rows.map((m) => ({ phone: m.phone, name: m.name, email: m.email, city: m.city, state: m.state, outcome: m.outcome, redropped: m.redropped, redroppedAt: m.redroppedAt, at: m.at })),
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

  const targets = [...green, ...recent].map((t) => ({ phone: t.phone, name: t.name, email: t.email, city: t.city, state: t.state, calledBack: t.calledBack, calledBackAt: t.calledBackAt, landedAt: t.landedAt, connectSec: t.connectSec, billable: t.billable, recordingUrl: t.recordingUrl, sentAt: t.at }));

  // Live delivery funnel across all batches (best-effort, from JDI). Also capture per-batch status.
  let delivered = 0, filtered = 0, loaded = 0, undelivered = 0, inQueue = 0, processing = false;
  const batchInfo: Record<string, { status: string; delivered: number; hopper: number }> = {};
  for (const b of batches) { if (b.jdiCampaignId) { const ov = await jdiOverview(b.jdiCampaignId); if (ov) { delivered += Number(ov.delivered || 0); filtered += Number(ov.filtered || 0); loaded += Number(ov.numbersLoaded || 0); undelivered += Number(ov.undelivered || 0); inQueue += Number(ov.hopperCount || 0); const st = String(ov.status || "").toUpperCase(); if (st === "ACTIVE") processing = true; batchInfo[b.id] = { status: st, delivered: Number(ov.delivered || 0), hopper: Number(ov.hopperCount || 0) }; } } }

  // Persist the live JDI delivered/filtered back to the campaign so /admin economics (cost per
  // delivered drop) reflect reality without polling JDI on every admin refresh.
  if (!combined && camps.length === 1) await db.outreachCampaign.update({ where: { id: camps[0].id }, data: { deliveredCount: delivered, filteredCount: filtered } }).catch(() => {});

  const sent = batches.reduce((a, b) => a + b.size, 0);
  const one = camps[0];
  // Live send state: drops only happen inside the campaign's hours, with an active non-empty queue,
  // and not paused. This is the top-of-page "SENDING NOW vs safe-to-change" signal.
  const withinWindow = !combined && one ? campaignOpen(one) : false;
  const sendingNow = withinWindow && processing && inQueue > 0 && !(one && "paused" in one && one.paused);
  const nextOpenAt = !combined && one ? nextWindowOpen(one) : null; // ms epoch of the next send-window open
  const campaign = combined
    ? { id: "", name: "All Combined", hasAudio: false, outboundAudioUrl: "", campaignNumber: "", routingNumber: "combined", listCount: totalList, sentTotal: sent, remaining: Math.max(0, totalList - sent), combined: true, paused: false }
    : { id: one.id, name: one.name, hasAudio: !!one.outboundAudioUrl, outboundAudioUrl: one.outboundAudioUrl, campaignNumber: one.campaignNumber, routingNumber: one.routingNumber, listCount: totalList, sentTotal: sent, remaining: Math.max(0, totalList - sent), combined: false, paused: one.paused };

  return NextResponse.json({
    ok: true, campaign, tests, cap: { maxPerHour: CAP_PER_HOUR },
    delivered, filtered, loaded, undelivered, inQueue, processing, sendingNow, withinWindow, nextOpenAt, sentCount, calledBackCount, billableCount,
    batches: batches.map((b) => ({ id: b.id, label: b.label, size: b.size, throttle: b.throttle, launchedAt: b.launchedAt, status: batchInfo[b.id]?.status || "", delivered: batchInfo[b.id]?.delivered || 0, hopper: batchInfo[b.id]?.hopper || 0 })),
    targets,
    callbacks: callbacks.map((cb) => ({ phone: cb.phone, name: cb.name, email: cb.email, city: cb.city, state: cb.state, landedAt: cb.landedAt, connectSec: cb.connectSec, billable: cb.billable, at: cb.at })),
  });
}
