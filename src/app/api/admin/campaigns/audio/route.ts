import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { coreUpload } from "@/lib/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save a recorded voicemail (outbound or follow-up) to a campaign. Stored via the Core (persistent URL).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  const campaignId = String(form?.get("campaignId") || "");
  const type = String(form?.get("type") || "outbound") === "followup" ? "followup" : "outbound";
  if (!file || !campaignId) return NextResponse.json({ error: "file and campaignId required." }, { status: 400 });
  const url = await coreUpload(file, `campaign-${campaignId}-${type}.webm`, `keywordcalls ${type} vm`);
  if (!url) return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  await db.outreachCampaign.update({ where: { id: campaignId }, data: type === "followup" ? { followupAudioUrl: url } : { outboundAudioUrl: url } });
  return NextResponse.json({ ok: true, url });
}
