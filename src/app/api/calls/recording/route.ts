import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const sid = new URL(req.url).searchParams.get("sid") || "";
  const form = await req.formData().catch(() => null);
  const rec = String(form?.get("RecordingUrl") || "");
  if (sid && rec) await db.call.updateMany({ where: { callSid: sid }, data: { recordingUrl: rec } }).catch(() => {});
  return new Response("", { status: 204 });
}
