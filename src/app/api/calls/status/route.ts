import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
// Number-level StatusCallback (billing happens in dial-status). Just records the final leg status.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const sid = String(form?.get("CallSid") || "");
  const status = String(form?.get("CallStatus") || "");
  if (sid && status) await db.call.updateMany({ where: { callSid: sid }, data: { status } }).catch(() => {});
  return new Response("", { status: 204 });
}
