import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { coreUpload } from "@/lib/core";
import { convertToMp3 } from "@/lib/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save a recorded voicemail (outbound or follow-up) to a campaign. Stored via the Core (persistent URL).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  const campaignId = String(form?.get("campaignId") || "");
  const raw = String(form?.get("type") || "outbound");
  const type = raw === "followup" ? "followup" : raw === "afterhours" ? "afterhours" : "outbound";
  if (!file || !campaignId) return NextResponse.json({ error: "file and campaignId required." }, { status: 400 });
  const mp3 = await convertToMp3(Buffer.from(await file.arrayBuffer()));
  if (!mp3) return NextResponse.json({ error: "Could not process the recording." }, { status: 502 });
  const url = await coreUpload(new Blob([new Uint8Array(mp3)], { type: "audio/mpeg" }), `campaign-${campaignId}-${type}.mp3`, `keywordcalls ${type} vm`);
  if (!url) return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  // Re-recording the outbound/after-hours clears its cached JDI upload so the new audio is used.
  const data = type === "followup" ? { followupAudioUrl: url }
    : type === "afterhours" ? { afterHoursAudioUrl: url, afterHoursJdiWav: "" }
    : { outboundAudioUrl: url, jdiWav: "" };
  await db.outreachCampaign.update({ where: { id: campaignId }, data });
  return NextResponse.json({ ok: true, url });
}
