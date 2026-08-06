import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio posts the final call outcome here → log voicemail-left vs not-connected for the live board.
export async function POST(req: NextRequest) {
  const to = new URL(req.url).searchParams.get("to") || "";
  const form = await req.formData().catch(() => null);
  const phone = to || String(form?.get("To") || "");
  const status = String(form?.get("CallStatus") || "");
  const answeredBy = String(form?.get("AnsweredBy") || "");

  if (answeredBy.startsWith("machine") && status === "completed") {
    await db.demoEvent.create({ data: { kind: "drop", phone, note: "voicemail left" } }).catch(() => {});
  } else if (answeredBy === "human") {
    await db.demoEvent.create({ data: { kind: "notconnected", phone, note: "reached a live person — not connected" } }).catch(() => {});
  } else {
    await db.demoEvent.create({ data: { kind: "notconnected", phone, note: `not connected${status ? ` (${status})` : ""}` } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
