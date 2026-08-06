import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { e164 } from "@/lib/twilio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }

// Someone calls the backend Twilio demo number back → log the live lead, then CONNECT them to the
// prospect's chosen callback number (set in the demo). If none set, play the thank-you.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const from = String(form?.get("From") || "");
  await db.demoEvent.create({ data: { kind: "callback", phone: from, note: "called back — live lead" } }).catch(() => {});
  const cfg = await getSettings(["demoCallbackTarget"]);
  const target = cfg.demoCallbackTarget ? e164(cfg.demoCallbackTarget) : "";
  if (target && target.length >= 11) {
    return xml(`<Say voice="Polly.Joanna-Neural">Connecting your high intent call now.</Say><Dial>${target}</Dial>`);
  }
  return xml(`<Say voice="Polly.Joanna-Neural">Thanks for calling back. You're now a live lead in the KeywordCalls system. This is how high intent calls are delivered in real time.</Say><Hangup/>`);
}
