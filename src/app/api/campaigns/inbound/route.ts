import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { campaignOpen } from "@/lib/outreach";
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
  const cb = await db.campaignCallback.create({ data: { campaignId: c.id, phone: from, name: ct ? `${ct.firstName} ${ct.lastName}`.trim() : "", email: ct?.email || "", city: ct?.city || "", state: ct?.state || "", landedAt: dest || "" } }).catch(() => null);
  // Flip the matching sent-target "green" on the rollout console, recording where it routed.
  if (digits) await db.rolloutTarget.updateMany({ where: { campaignId: c.id, phone: { contains: digits } }, data: { calledBack: true, calledBackAt: new Date(), landedAt: dest || "" } }).catch(() => {});

  if (campaignOpen(c) && dest && dest.length >= 11) {
    // In hours → connect the live callback to the owner (real caller shown). The Dial `action` posts
    // back the transferred-leg talk time → we record connectSec and bill at 120s+.
    const callerAttr = from ? ` callerId="${from}"` : "";
    const action = `https://keywordcalls.com/api/campaigns/dial-status?cb=${encodeURIComponent(cb?.id || "")}`;
    return xml(`<Dial${callerAttr} timeout="25" action="${action}" method="POST"><Number>${dest}</Number></Dial>`);
  }
  // After hours (or no destination set) → play the closed message.
  return xml(`<Say voice="Polly.Joanna-Neural">${esc(c.afterHoursMessage)}</Say><Hangup/>`);
}
