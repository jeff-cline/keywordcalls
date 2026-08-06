import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const from = String(form?.get("From") || "");
  await db.demoEvent.create({ data: { kind: "callback", phone: from, note: "called back — live lead" } }).catch(() => {});
  return xml(`<Say voice="Polly.Joanna-Neural">Thanks for calling back. You're now a live lead in the KeywordCalls system. This is how high intent calls are delivered in real time.</Say><Hangup/>`);
}
