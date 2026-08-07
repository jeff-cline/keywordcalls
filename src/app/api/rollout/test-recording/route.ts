import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio posts here when a laptop-test recording finishes → save it on the matching TestCall (by the
// number we dialed from).
export async function POST(req: NextRequest) {
  const from = new URL(req.url).searchParams.get("from") || "";
  const form = await req.formData().catch(() => null);
  const url = String(form?.get("RecordingUrl") || "");
  const dg = from.replace(/\D/g, "").slice(-10);
  if (dg && url) {
    const tc = await db.testCall.findFirst({ where: { fromNumber: { contains: dg } }, orderBy: { at: "desc" } }).catch(() => null);
    if (tc) await db.testCall.update({ where: { id: tc.id }, data: { recordingUrl: url } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
