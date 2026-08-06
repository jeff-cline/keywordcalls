import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSetup, testDrop, dropTwimlUrl } from "@/lib/outreach";
import { getSettings } from "@/lib/settings";
import { sendCoreEmail, coreCall } from "@/lib/core";

export const runtime = "nodejs";

// Create or update an outbound campaign.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = {
    name: String(b.name || "Untitled campaign").slice(0, 120),
    listId: b.listId ? String(b.listId) : null,
    states: JSON.stringify(Array.isArray(b.states) ? (b.states as unknown[]).map(String) : []),
    bidCents: Math.round(parseFloat(String(b.bidDollars ?? "0")) * 100) || 0,
    hoursStart: String(b.hoursStart || "08:30"),
    hoursEnd: String(b.hoursEnd || "17:00"),
    tz: String(b.tz || "America/New_York"),
    afterHoursMessage: String(b.afterHoursMessage || "").slice(0, 500) || undefined,
    followupMessage: String(b.followupMessage || "").slice(0, 500) || undefined,
    mode: ["voice_email", "voice_only", "email_only"].includes(String(b.mode)) ? String(b.mode) : "voice_email",
    emailDelayMin: Math.max(0, parseInt(String(b.emailDelayMin ?? "5"), 10) || 5),
    callsPerMin: Math.max(1, Math.min(60, parseInt(String(b.callsPerMin ?? "30"), 10) || 30)),
    emailSubject: String(b.emailSubject || "").slice(0, 200) || undefined,
    emailBody: String(b.emailBody || "").slice(0, 4000) || undefined,
  };
  Object.keys(data).forEach((k) => (data as Record<string, unknown>)[k] === undefined && delete (data as Record<string, unknown>)[k]);
  const id = String(b.id || "");
  const c = id
    ? await db.outreachCampaign.update({ where: { id }, data })
    : await db.outreachCampaign.create({ data });
  return NextResponse.json({ ok: true, id: c.id });
}

// Actions: toggle on/off, duplicate, test-call, delete.
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id || "");
  const action = String(b.action || "");
  const c = await db.outreachCampaign.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  if (action === "toggle") {
    const turningOn = c.status !== "on";
    if (turningOn) {
      const setup = campaignSetup(c);
      if (!setup.ok) return NextResponse.json({ error: `Finish setup first — missing: ${setup.missing.join(", ")}.` }, { status: 400 });
    }
    await db.outreachCampaign.update({ where: { id }, data: turningOn ? { status: "on", startedAt: new Date(), finishedAt: null } : { status: "off" } });
    return NextResponse.json({ ok: true, status: turningOn ? "on" : "off" });
  }
  if (action === "duplicate") {
    const dup = await db.outreachCampaign.create({ data: {
      name: `${c.name} (copy)`, listId: c.listId, states: c.states, bidCents: c.bidCents,
      hoursStart: c.hoursStart, hoursEnd: c.hoursEnd, tz: c.tz,
      outboundAudioUrl: c.outboundAudioUrl, followupAudioUrl: c.followupAudioUrl,
      afterHoursMessage: c.afterHoursMessage, followupMessage: c.followupMessage, status: "off",
    } });
    return NextResponse.json({ ok: true, id: dup.id });
  }
  if (action === "testcall") {
    if (!c.outboundAudioUrl) return NextResponse.json({ error: "Record the outbound voicemail first." }, { status: 400 });
    const set = await getSettings(["notifyPhone"]);
    const to = String(b.to || set.notifyPhone || "9728006670");
    const r = await testDrop(c.id, to);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }
  if (action === "delete") {
    await db.outreachCampaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  if (action === "test25") {
    // Send a real 25-contact test batch across Zapmail (email) + Core Twilio (voice drop).
    if (!c.listId) return NextResponse.json({ error: "Attach a list first." }, { status: 400 });
    let states: string[] = []; try { states = JSON.parse(c.states); } catch {}
    const contacts = await db.listContact.findMany({ where: { listId: c.listId, ...(states.length ? { state: { in: states } } : {}) }, take: 25 });
    if (!contacts.length) return NextResponse.json({ error: "No contacts match this campaign." }, { status: 400 });
    const subject = c.emailSubject || `A quick note from KeywordCalls`;
    const bodyHtml = (name: string) => `<p>Hi ${name || "there"},</p>${(c.emailBody || "We wanted to reach out. Reply or give us a call back.").split("\n").map((l) => `<p>${l}</p>`).join("")}`;
    let emails = 0, calls = 0;
    for (const ct of contacts) {
      if (c.mode !== "voice_only" && ct.email) { if (await sendCoreEmail(ct.email, subject, bodyHtml(ct.firstName), "campaign_test")) emails++; }
      if (c.mode !== "email_only" && ct.phone && c.outboundAudioUrl) { const r = await coreCall(ct.phone, { twimlUrl: dropTwimlUrl(c.id, "outbound") }); if (r.ok) calls++; }
    }
    return NextResponse.json({ ok: true, attempted: contacts.length, emails, calls });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
