import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { campaignOpen } from "@/lib/outreach";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Someone the campaign contacted is calling back. In hours → connect; after hours → play the
// closed message and queue a next-day follow-up voicemail.
export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const id = u.searchParams.get("c") || "";
  const c = await db.outreachCampaign.findUnique({ where: { id } });
  if (!c) return xml(`<Say voice="Polly.Joanna-Neural">This number is not in service.</Say><Hangup/>`);
  if (campaignOpen(c)) {
    // In business hours — this is where the call center number would be dialed.
    return xml(`<Say voice="Polly.Joanna-Neural">Thanks for calling. Connecting you now.</Say><Pause length="1"/><Say voice="Polly.Joanna-Neural">Please hold.</Say>`);
  }
  // After hours: play the closed message. (The next-day follow-up voicemail is queued by the runner.)
  return xml(`<Say voice="Polly.Joanna-Neural">${esc(c.afterHoursMessage)}</Say><Hangup/>`);
}
