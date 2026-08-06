import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { campaignOpen } from "@/lib/outreach";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Someone the campaign contacted is calling back. Look the campaign up by the number they dialed.
// A callback is a delivered, monetized call → credit the campaign's revenue (its bid).
export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const form = await req.formData().catch(() => null);
  const to = String(form?.get("To") || "");
  const id = u.searchParams.get("c") || "";
  const c = id
    ? await db.outreachCampaign.findUnique({ where: { id } })
    : await db.outreachCampaign.findFirst({ where: { campaignNumber: to } });
  if (!c) return xml(`<Say voice="Polly.Joanna-Neural">This number is not in service.</Say><Hangup/>`);
  await db.outreachCampaign.update({ where: { id: c.id }, data: { connectedCount: { increment: 1 }, revenueCents: { increment: c.bidCents } } }).catch(() => {});
  if (campaignOpen(c)) {
    // In business hours — this is where the call center number would be dialed.
    return xml(`<Say voice="Polly.Joanna-Neural">Thanks for calling. Connecting you now.</Say><Pause length="1"/><Say voice="Polly.Joanna-Neural">Please hold.</Say>`);
  }
  // After hours: play the closed message. (The next-day follow-up voicemail is queued by the runner.)
  return xml(`<Say voice="Polly.Joanna-Neural">${esc(c.afterHoursMessage)}</Say><Hangup/>`);
}
