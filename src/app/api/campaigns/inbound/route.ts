import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { e164 } from "@/lib/twilio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Someone the campaign contacted is calling back the campaign's Twilio number. Look up which
// campaign owns that number → credit revenue → route the LIVE call to that campaign's owner
// (routingNumber) with the real caller's number passed through.
export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const form = await req.formData().catch(() => null);
  const to = String(form?.get("To") || "");
  const from = String(form?.get("From") || "");
  const id = u.searchParams.get("c") || "";
  const c = id
    ? await db.outreachCampaign.findUnique({ where: { id } })
    : await db.outreachCampaign.findFirst({ where: { campaignNumber: to } });
  if (!c) return xml(`<Say voice="Polly.Joanna-Neural">This number is not in service.</Say><Hangup/>`);
  await db.outreachCampaign.update({ where: { id: c.id }, data: { connectedCount: { increment: 1 } } }).catch(() => {}); // revenue credited only if billable (120s+)

  // Append + create the callback record synchronously so we can attach the duration callback to it.
  const dest = e164(c.routingNumber);
  const digits = from.replace(/\D/g, "").slice(-10);
  const ct = digits ? await db.listContact.findFirst({ where: { OR: [{ phone: { contains: digits } }, { altPhones: { contains: digits } }] } }).catch(() => null) : null;
  const hasDest = !!dest && dest.length >= 11;
  const cb = await db.campaignCallback.create({ data: { campaignId: c.id, phone: from, name: ct ? `${ct.firstName} ${ct.lastName}`.trim() : "", email: ct?.email || "", city: ct?.city || "", state: ct?.state || "", landedAt: dest || "", outcome: hasDest ? "" : "no_route" } }).catch(() => null);
  // Flip the matching sent-target "green" on the rollout console, recording where it routed.
  if (digits) await db.rolloutTarget.updateMany({ where: { campaignId: c.id, phone: { contains: digits } }, data: { calledBack: true, calledBackAt: new Date(), landedAt: dest || "" } }).catch(() => {});

  if (hasDest) {
    // ALWAYS connect the callback to the buyer — even outside campaign hours, the buyer may be open.
    // Real caller shown. The Dial `action` posts back the talk time → we record connectSec and bill at
    // 120s+, or (if the buyer doesn't answer) flag the lead + play the after-hours reminder.
    const callerAttr = from ? ` callerId="${from}"` : "";
    const cbId = encodeURIComponent(cb?.id || "");
    const action = `https://keywordcalls.com/api/campaigns/dial-status?cb=${cbId}`;
    const recCb = `https://keywordcalls.com/api/campaigns/recording?cb=${cbId}`;
    // record="record-from-ringing-dual" captures both legs from the ring, so you can hear the transfer
    // itself + what's said — even on short calls. Recording URL is posted back when it finalizes.
    return xml(`<Dial${callerAttr} timeout="25" action="${action}" method="POST" record="record-from-ringing-dual" recordingStatusCallback="${recCb}" recordingStatusCallbackEvent="completed"><Number>${dest}</Number></Dial>`);
  }
  // No routing number set → can't connect. Capture the lead for the 10am re-drop and play the reminder.
  if (c.afterHoursAudioUrl) return xml(`<Play>${esc(c.afterHoursAudioUrl)}</Play><Hangup/>`);
  return xml(`<Say voice="Polly.Joanna-Neural">${esc(c.afterHoursMessage)}</Say><Hangup/>`);
}
