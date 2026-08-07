import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTwilioCfg } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// God: stream a callback-transfer recording. Twilio recordings need account auth, so we proxy the
// mp3 through here (the God session cookie authorizes the browser's <audio> request).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const u = new URL(req.url);
  const cbId = u.searchParams.get("cb") || "";
  const phone = u.searchParams.get("phone") || "";

  let recUrl = "";
  if (cbId) recUrl = (await db.campaignCallback.findUnique({ where: { id: cbId } }))?.recordingUrl || "";
  else if (phone) { const dg = phone.replace(/\D/g, "").slice(-10); if (dg) recUrl = (await db.rolloutTarget.findFirst({ where: { phone: { contains: dg }, recordingUrl: { not: "" } }, orderBy: { at: "desc" } }))?.recordingUrl || ""; }
  if (!recUrl) return NextResponse.json({ error: "No recording yet." }, { status: 404 });

  const cfg = await getTwilioCfg();
  if (!cfg) return NextResponse.json({ error: "Telephony not configured." }, { status: 400 });
  const auth = "Basic " + Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");
  const tw = await fetch(`${recUrl}.mp3`, { headers: { Authorization: auth } }).catch(() => null);
  if (!tw || !tw.ok || !tw.body) return NextResponse.json({ error: "Recording not ready." }, { status: 404 });
  return new Response(tw.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}
