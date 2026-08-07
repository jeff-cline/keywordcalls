import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { e164 } from "@/lib/twilio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// TwiML for the "test the buyer line" call: Twilio calls the tester's phone, plays a note, then dials
// the campaign's routing number exactly like a real callback (same caller ID passthrough), so the
// tester hears whether the buyer answers — and can talk to them if they do.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("c") || "";
  const c = id ? await db.outreachCampaign.findUnique({ where: { id } }) : await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } });
  const dest = e164(c?.routingNumber || "");
  const cid = (c?.campaignNumber || "").replace(/\D/g, "");
  if (!dest || dest.length < 11) return xml(`<Say voice="Polly.Joanna-Neural">No buyer routing number is set for this campaign.</Say><Hangup/>`);
  const callerAttr = cid ? ` callerId="${cid}"` : "";
  return xml(`<Say voice="Polly.Joanna-Neural">Testing your buyer line now. Connecting you to ${dest.replace(/\D/g, "").split("").join(" ")} — if it rings out with no answer, that's what your callers are hitting.</Say><Dial${callerAttr} timeout="30" action="https://keywordcalls.com/api/rollout/test-twiml?done=1"><Number>${esc(dest)}</Number></Dial>`);
}

// After the Dial ends, tell the tester the result if the buyer didn't answer.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const status = String(form?.get("DialCallStatus") || "").toLowerCase();
  if (status === "completed") return xml(`<Hangup/>`);
  return xml(`<Say voice="Polly.Joanna-Neural">The buyer line did not answer — status was ${esc(status || "no answer")}. This is why your callbacks are not connecting.</Say><Hangup/>`);
}
