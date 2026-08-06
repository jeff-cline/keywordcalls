import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { acquireForCampaign } from "@/lib/numbers";
import { jdiConfigured, jdiUploadAudioFromUrl, jdiCreateCampaign } from "@/lib/jdi";

export const runtime = "nodejs";
export const maxDuration = 60;
const parse = (s: string) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };

// Launch one manual rollout batch (N ringless drops, throttled) — God only.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!(await jdiConfigured())) return NextResponse.json({ error: "Ringless (JDI) not configured." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const campaignId = String(b.campaignId || "");
  const size = Math.min(5000, Math.max(1, parseInt(String(b.size || "100"), 10) || 100));
  const throttle = Math.max(1, parseInt(String(b.throttle || "500"), 10) || 500);
  const label = String(b.label || `Batch ${size}`).slice(0, 60);

  const c = await db.outreachCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (!c.outboundAudioUrl) return NextResponse.json({ error: "Record the outbound voicemail on this campaign first." }, { status: 400 });
  if (!c.listId) return NextResponse.json({ error: "No list attached." }, { status: 400 });

  // Ensure the campaign has its own Twilio callback number.
  let campaignNumber = c.campaignNumber;
  if (!campaignNumber) {
    const got = await acquireForCampaign({ moneyWord: `campaign:${c.name}`, campaignId: c.id, campaignName: c.name, voicePath: "/api/campaigns/inbound" });
    if (!got.ok || !got.number) return NextResponse.json({ error: got.error || "Could not get a number." }, { status: 502 });
    campaignNumber = got.number;
    await db.outreachCampaign.update({ where: { id: c.id }, data: { campaignNumber: got.number, campaignNumberSid: got.sid || "" } });
  }

  // Ensure the recording is in JDI's library.
  let wav = c.jdiWav;
  if (!wav) { wav = (await jdiUploadAudioFromUrl(c.outboundAudioUrl)) || ""; if (wav) await db.outreachCampaign.update({ where: { id: c.id }, data: { jdiWav: wav } }); }
  if (!wav) return NextResponse.json({ error: "Could not load the recording into the ringless system." }, { status: 502 });

  // Take the next N eligible contacts (with their appended data).
  const states = parse(c.states);
  const contacts = await db.listContact.findMany({
    where: { listId: c.listId, id: { gt: c.rolloutCursor }, ...(states.length ? { state: { in: states } } : {}), phone: { not: "" } },
    orderBy: { id: "asc" }, take: size,
  });
  if (contacts.length === 0) return NextResponse.json({ error: "No more contacts left in the list." }, { status: 400 });
  const seen = new Set<string>();
  const targets = contacts.filter((x) => { const n = x.phone.replace(/\D/g, ""); if (n.length < 10 || seen.has(n)) return false; seen.add(n); return true; });
  const numbers = targets.map((x) => x.phone.replace(/\D/g, ""));

  const r = await jdiCreateCampaign({
    name: `${c.name.slice(0, 14)} ${Date.now().toString().slice(-6)}`, wavUrl: wav, callback: campaignNumber.replace(/\D/g, ""), numbers,
    throttle, startTime: c.hoursStart, stopTime: c.hoursEnd, runDays: "1,2,3,4,5", timezone: c.tz,
    stateCheck: true, performance: true, autoStart: true, // DNC / litigator scrub ON (real cold leads)
  });
  if (!r.ok) return NextResponse.json({ error: r.error || "Ringless launch failed." }, { status: 502 });

  await db.outreachCampaign.update({ where: { id: c.id }, data: { rolloutCursor: contacts[contacts.length - 1].id, dialedCount: { increment: numbers.length } } });
  const batch = await db.rolloutBatch.create({ data: { campaignId: c.id, label, size: numbers.length, jdiCampaignId: String(r.campaignId || ""), throttle } });
  // Record every sent number as a target (appended up front) → the console's sent list.
  await db.rolloutTarget.createMany({ data: targets.map((x) => ({ campaignId: c.id, batchId: batch.id, phone: "+1" + x.phone.replace(/\D/g, "").slice(-10), name: `${x.firstName} ${x.lastName}`.trim(), email: x.email, city: x.city, state: x.state })) });
  return NextResponse.json({ ok: true, sent: numbers.length, batchId: batch.id, jdiCampaignId: r.campaignId });
}
