import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCsv, contactsFromRows } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const GROUPS = ["A", "B", "C", "D"];

// Upload a new lead file as a NEW rollout test group (B/C/D), cloning the original campaign's settings.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file." }, { status: 400 });
  const givenName = String(form?.get("name") || "").trim().slice(0, 80); // what the user names this test

  // Template = the original (group A) or the first campaign.
  const tmpl = (await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } })) || (await db.outreachCampaign.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!tmpl) return NextResponse.json({ error: "No template campaign to clone." }, { status: 400 });

  // Next free group letter.
  const used = new Set((await db.outreachCampaign.findMany({ where: { rolloutGroup: { not: "" } }, select: { rolloutGroup: true } })).map((c) => c.rolloutGroup));
  const group = GROUPS.find((g) => !used.has(g));
  if (!group) return NextResponse.json({ error: "All 4 test slots (A–D) are in use." }, { status: 400 });

  // Parse + store the list.
  const rows = parseCsv(await file.text());
  const contacts = contactsFromRows(rows);
  if (!contacts.length) return NextResponse.json({ error: "No usable rows (need a phone column)." }, { status: 400 });
  const testName = givenName || file.name.replace(/\.csv$/i, "");
  const list = await db.callList.create({ data: { name: `${group} · ${testName}`.slice(0, 120), source: file.name, rowCount: contacts.length } });
  for (let i = 0; i < contacts.length; i += 1000) await db.listContact.createMany({ data: contacts.slice(i, i + 1000).map((c) => ({ ...c, listId: list.id })) });

  // Clone the template into a new campaign for this group + list.
  const camp = await db.outreachCampaign.create({ data: {
    name: testName ? `${group} · ${testName}`.slice(0, 80) : `Test ${group}`, rolloutGroup: group, listId: list.id,
    states: tmpl.states, bidCents: tmpl.bidCents, hoursStart: tmpl.hoursStart, hoursEnd: tmpl.hoursEnd, tz: tmpl.tz,
    mode: tmpl.mode, callsPerMin: tmpl.callsPerMin, emailSubject: tmpl.emailSubject, emailBody: tmpl.emailBody,
    afterHoursMessage: tmpl.afterHoursMessage, followupMessage: tmpl.followupMessage,
    outboundAudioUrl: tmpl.outboundAudioUrl, routingNumber: tmpl.routingNumber, // reuse recording + callback number
  } });
  return NextResponse.json({ ok: true, campaignId: camp.id, group, count: contacts.length, name: testName });
}
