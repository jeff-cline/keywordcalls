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
  await db.outreachCampaign.update({ where: { id: c.id }, data: { connectedCount: { increment: 1 }, revenueCents: { increment: c.bidCents } } }).catch(() => {});
  // Log the callback with any appended data → powers the /rollout time-series + lead identity.
  (async () => {
    const digits = from.replace(/\D/g, "").slice(-10);
    const ct = digits ? await db.listContact.findFirst({ where: { OR: [{ phone: { contains: digits } }, { altPhones: { contains: digits } }] } }).catch(() => null) : null;
    await db.campaignCallback.create({ data: { campaignId: c.id, phone: from, name: ct ? `${ct.firstName} ${ct.lastName}`.trim() : "", email: ct?.email || "", city: ct?.city || "", state: ct?.state || "" } }).catch(() => {});
  })().catch(() => {});

  const dest = e164(c.routingNumber);
  if (campaignOpen(c) && dest && dest.length >= 11) {
    // In hours → connect the live callback straight to the campaign owner, showing the real caller.
    const callerAttr = from ? ` callerId="${from}"` : "";
    return xml(`<Dial${callerAttr} timeout="25"><Number>${dest}</Number></Dial>`);
  }
  // After hours (or no destination set) → play the closed message.
  return xml(`<Say voice="Polly.Joanna-Neural">${esc(c.afterHoursMessage)}</Say><Hangup/>`);
}
