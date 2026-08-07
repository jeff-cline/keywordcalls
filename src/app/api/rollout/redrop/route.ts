import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { jdiConfigured, jdiUploadAudioFromUrl, jdiCreateCampaign } from "@/lib/jdi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Recovery re-drop: send the "sorry we missed you" ringless voicemail to everyone who called back
// but didn't reach an agent (after-hours or the center didn't answer) and hasn't been re-dropped yet.
// Called by the daily 10am-ET cron (?scheduled=1&key=SECRET) and by the manual God button.
export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const scheduled = u.searchParams.get("scheduled") === "1";
  const key = u.searchParams.get("key") || "";

  // Auth: a God session, OR the cron secret.
  const cronKey = (await db.setting.findUnique({ where: { key: "cronSecret" } }))?.value || "";
  const authed = scheduled ? (!!cronKey && key === cronKey) : isGod(await getSession());
  if (!authed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // The scheduled run only fires at 10am Eastern (cron hits us at 14:00 & 15:00 UTC to cover DST).
  if (scheduled) {
    const etHour = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }), 10);
    if (etHour !== 10) return NextResponse.json({ ok: true, skipped: `not 10am ET (is ${etHour})` });
  }

  if (!(await jdiConfigured())) return NextResponse.json({ error: "Ringless (JDI) not configured." }, { status: 400 });

  const camps = await db.outreachCampaign.findMany({ where: { OR: [{ rolloutGroup: { not: "" } }] } });
  let totalSent = 0; const perCampaign: { campaign: string; sent: number; note?: string }[] = [];

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000); // don't re-drop a call that may still be in progress
  for (const c of camps) {
    const pending = await db.campaignCallback.findMany({ where: { campaignId: c.id, connectSec: 0, redropped: false, at: { lt: fiveMinAgo } } });
    if (pending.length === 0) continue;
    if (!c.afterHoursAudioUrl) { perCampaign.push({ campaign: c.name, sent: 0, note: "no after-hours recording" }); continue; }
    if (!c.campaignNumber) { perCampaign.push({ campaign: c.name, sent: 0, note: "no callback number" }); continue; }

    // Dedupe the pending numbers.
    const seen = new Set<string>();
    const numbers = pending.map((p) => p.phone.replace(/\D/g, "").slice(-10)).filter((n) => n.length === 10 && !seen.has(n) && seen.add(n));
    if (numbers.length === 0) continue;

    // Ensure the after-hours audio is in JDI's library.
    let wav = c.afterHoursJdiWav;
    if (!wav) { wav = (await jdiUploadAudioFromUrl(c.afterHoursAudioUrl)) || ""; if (wav) await db.outreachCampaign.update({ where: { id: c.id }, data: { afterHoursJdiWav: wav } }); }
    if (!wav) { perCampaign.push({ campaign: c.name, sent: 0, note: "could not load recording into JDI" }); continue; }

    const r = await jdiCreateCampaign({
      name: `Recovery ${c.name.slice(0, 8)} ${Date.now().toString().slice(-5)}`, wavUrl: wav, callback: c.campaignNumber.replace(/\D/g, ""), numbers,
      throttle: 5000, startTime: c.hoursStart, stopTime: c.hoursEnd, runDays: "1,2,3,4,5", timezone: c.tz,
      stateCheck: true, performance: true, autoStart: true,
    });
    if (!r.ok) { perCampaign.push({ campaign: c.name, sent: 0, note: r.error || "JDI launch failed" }); continue; }

    await db.campaignCallback.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { redropped: true, redroppedAt: new Date() } });
    await db.rolloutBatch.create({ data: { campaignId: c.id, label: `♻️ Recovery re-drop · ${numbers.length}`, size: numbers.length, jdiCampaignId: String(r.campaignId || ""), throttle: 5000 } });
    totalSent += numbers.length; perCampaign.push({ campaign: c.name, sent: numbers.length });
  }

  return NextResponse.json({ ok: true, totalSent, perCampaign });
}
