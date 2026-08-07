import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Fires when the transferred callback leg ends → record how long the owner was actually connected.
// Billable at 120s+; revenue (the bid) is credited only on billable connects. If the call center did
// NOT answer (no-answer/busy/failed), flag the lead for tomorrow's 10am recovery re-drop and play the
// caller a short "we missed you" message so the live call isn't just dropped.
export async function POST(req: NextRequest) {
  const cbId = new URL(req.url).searchParams.get("cb") || "";
  const form = await req.formData().catch(() => null);
  const dur = parseInt(String(form?.get("DialCallDuration") || "0"), 10) || 0;
  const status = String(form?.get("DialCallStatus") || "").toLowerCase(); // completed | no-answer | busy | failed | canceled
  const parentStatus = String(form?.get("CallStatus") || "").toLowerCase(); // the CALLER leg's status when the dial ended
  const answered = status === "completed" && dur > 0;
  // Who hung up: if the caller (parent) leg is already "completed" when the dial ends, the CALLER hung
  // up; if it's still in-progress, the BUYER hung up. If the buyer never answered → no_answer.
  const endedBy = !answered ? "no_answer" : parentStatus === "completed" ? "caller" : "buyer";
  let missMsg = ""; // recovery audio/text played when the transfer wasn't answered

  if (cbId) {
    const cb = await db.campaignCallback.findUnique({ where: { id: cbId } }).catch(() => null);
    if (cb && cb.outcome !== "connected") {
      if (answered) {
        const billable = dur >= 120;
        await db.campaignCallback.update({ where: { id: cbId }, data: { connectSec: dur, billable, outcome: "connected", endedBy } }).catch(() => {});
        const dg = cb.phone.replace(/\D/g, "").slice(-10);
        if (dg) await db.rolloutTarget.updateMany({ where: { campaignId: cb.campaignId, phone: { contains: dg } }, data: { connectSec: dur, billable, endedBy } }).catch(() => {});
        if (billable) {
          const c = await db.outreachCampaign.findUnique({ where: { id: cb.campaignId } }).catch(() => null);
          if (c) await db.outreachCampaign.update({ where: { id: c.id }, data: { revenueCents: { increment: c.bidCents } } }).catch(() => {});
        }
      } else {
        // Center didn't pick up → mark for tomorrow's 10am re-drop and greet the caller so we don't lose them.
        await db.campaignCallback.update({ where: { id: cbId }, data: { outcome: "no_answer", endedBy: "no_answer" } }).catch(() => {});
        const dg2 = cb.phone.replace(/\D/g, "").slice(-10);
        if (dg2) await db.rolloutTarget.updateMany({ where: { campaignId: cb.campaignId, phone: { contains: dg2 } }, data: { endedBy: "no_answer" } }).catch(() => {});
        const c = await db.outreachCampaign.findUnique({ where: { id: cb.campaignId } }).catch(() => null);
        missMsg = c?.afterHoursAudioUrl
          ? `<Play>${esc(c.afterHoursAudioUrl)}</Play>`
          : `<Say voice="Polly.Joanna-Neural">${esc(c?.afterHoursMessage || "Sorry we missed you — we'll call you right back during business hours.")}</Say>`;
      }
    }
  }
  return xml(`${missMsg}<Hangup/>`);
}
