import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio posts each drop's final outcome → record voicemail-left vs not-connected on the OutreachCall.
export async function POST(req: NextRequest) {
  const ocId = new URL(req.url).searchParams.get("oc") || "";
  const form = await req.formData().catch(() => null);
  const status = String(form?.get("CallStatus") || "");
  const answeredBy = String(form?.get("AnsweredBy") || "");
  const outcome = answeredBy.startsWith("machine") && status === "completed" ? "vm_left" : "not_connected";
  if (ocId) await db.outreachCall.update({ where: { id: ocId }, data: { outcome } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
