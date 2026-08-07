import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { e164 } from "@/lib/twilio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Voice URL for the browser test's TwiML App. When the laptop places the test call, Twilio hits this
// and we dial the buyer's routing number using the FRESH test number as caller ID (so Ringba doesn't
// see a duplicate). answerOnBridge keeps the tester hearing ringing until the buyer actually answers.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  // Dial finished → tell the tester the result if the buyer never answered.
  if (new URL(req.url).searchParams.get("done") === "1") {
    const st = String(form?.get("DialCallStatus") || "").toLowerCase();
    if (st === "completed") return xml(`<Hangup/>`);
    return xml(`<Say voice="Polly.Joanna-Neural">The buyer line did not answer — the status was ${esc(st || "no answer")}. This is exactly what your callers hit.</Say><Hangup/>`);
  }
  const callerRaw = String(form?.get("callerId") || "").replace(/\D/g, "");
  const campaignId = String(form?.get("campaignId") || "");
  const c = campaignId ? await db.outreachCampaign.findUnique({ where: { id: campaignId } }) : await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } });
  const dest = e164(c?.routingNumber || "");
  if (!dest || dest.length < 11) return xml(`<Say voice="Polly.Joanna-Neural">No buyer routing number is set.</Say><Hangup/>`);
  const callerId = callerRaw.length === 10 ? `+1${callerRaw}` : callerRaw.length === 11 ? `+${callerRaw}` : "";
  const callerAttr = callerId ? ` callerId="${callerId}"` : "";
  return xml(`<Dial${callerAttr} answerOnBridge="true" timeout="30" action="https://keywordcalls.com/api/rollout/test-voice?done=1"><Number>${esc(dest)}</Number></Dial>`);
}

// After the dial ends, if the buyer never answered, tell the tester through their speakers.
export async function GET() { return xml(`<Hangup/>`); }
