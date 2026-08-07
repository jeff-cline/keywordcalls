import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio posts here when a callback-transfer recording finishes → store it on the callback + target.
export async function POST(req: NextRequest) {
  const cbId = new URL(req.url).searchParams.get("cb") || "";
  const form = await req.formData().catch(() => null);
  const url = String(form?.get("RecordingUrl") || ""); // Twilio resource URL (append .mp3, auth to fetch)
  if (!cbId || !url) return NextResponse.json({ ok: false });
  const cb = await db.campaignCallback.findUnique({ where: { id: cbId } }).catch(() => null);
  if (cb) {
    await db.campaignCallback.update({ where: { id: cbId }, data: { recordingUrl: url } }).catch(() => {});
    const dg = cb.phone.replace(/\D/g, "").slice(-10);
    if (dg) await db.rolloutTarget.updateMany({ where: { campaignId: cb.campaignId, phone: { contains: dg } }, data: { recordingUrl: url } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
