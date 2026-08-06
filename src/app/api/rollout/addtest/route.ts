import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { streamCsvRows, headerIndex, rowToContact } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const GROUPS = ["A", "B", "C", "D"];

// Upload a new lead file as a NEW rollout test group (B/C/D), cloning the original campaign's settings.
// Streams the CSV row-by-row and inserts in batches so even very large files parse with flat memory
// (a whole-file parse OOM-crashed the app on this 3.8GB box).
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

  const testName = givenName || file.name.replace(/\.csv$/i, "");
  const list = await db.callList.create({ data: { name: `${group} · ${testName}`.slice(0, 120), source: file.name, rowCount: 0 } });

  // Stream-parse: header first, then map each row → contact, dedupe by phone, insert in 1k chunks.
  let idx: ReturnType<typeof headerIndex> | null = null;
  const seen = new Set<string>();
  let batch: ReturnType<typeof rowToContact>[] = [];
  let total = 0;
  const flush = async () => {
    if (!batch.length) return;
    await db.listContact.createMany({ data: batch.map((c) => ({ ...c!, listId: list.id })) });
    total += batch.length; batch = [];
  };
  try {
    for await (const row of streamCsvRows(file.stream())) {
      if (!idx) { idx = headerIndex(row); continue; } // first row = header
      const c = rowToContact(idx, row);
      if (!c) continue;
      const key = c.phone.replace(/\D/g, "");
      if (seen.has(key)) continue;
      seen.add(key);
      batch.push(c);
      if (batch.length >= 1000) await flush();
    }
    await flush();
  } catch {
    await db.callList.delete({ where: { id: list.id } }).catch(() => {});
    return NextResponse.json({ error: "Could not read that file — make sure it's a CSV." }, { status: 400 });
  }

  if (total === 0) {
    await db.callList.delete({ where: { id: list.id } }).catch(() => {});
    return NextResponse.json({ error: "No usable rows (need a personal_phone / mobile_phone / direct_number column)." }, { status: 400 });
  }
  await db.callList.update({ where: { id: list.id }, data: { rowCount: total } }).catch(() => {});

  // Clone the template into a new campaign for this group + list.
  const camp = await db.outreachCampaign.create({ data: {
    name: `${group} · ${testName}`.slice(0, 80), rolloutGroup: group, listId: list.id,
    states: tmpl.states, bidCents: tmpl.bidCents, hoursStart: tmpl.hoursStart, hoursEnd: tmpl.hoursEnd, tz: tmpl.tz,
    mode: tmpl.mode, callsPerMin: tmpl.callsPerMin, emailSubject: tmpl.emailSubject, emailBody: tmpl.emailBody,
    afterHoursMessage: tmpl.afterHoursMessage, followupMessage: tmpl.followupMessage,
    outboundAudioUrl: tmpl.outboundAudioUrl, afterHoursAudioUrl: tmpl.afterHoursAudioUrl, routingNumber: tmpl.routingNumber,
  } });
  return NextResponse.json({ ok: true, campaignId: camp.id, group, count: total, name: testName });
}
