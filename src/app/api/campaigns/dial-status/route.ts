import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }

// Fires when the transferred callback leg ends → record how long the owner was actually connected.
// Billable at 120s+; revenue (the bid) is credited only on billable connects.
export async function POST(req: NextRequest) {
  const cbId = new URL(req.url).searchParams.get("cb") || "";
  const form = await req.formData().catch(() => null);
  const dur = parseInt(String(form?.get("DialCallDuration") || "0"), 10) || 0;
  if (cbId) {
    const cb = await db.campaignCallback.findUnique({ where: { id: cbId } }).catch(() => null);
    if (cb && !cb.billable) {
      const billable = dur >= 120;
      await db.campaignCallback.update({ where: { id: cbId }, data: { connectSec: dur, billable } }).catch(() => {});
      const dg = cb.phone.replace(/\D/g, "").slice(-10);
      if (dg) await db.rolloutTarget.updateMany({ where: { campaignId: cb.campaignId, phone: { contains: dg } }, data: { connectSec: dur, billable } }).catch(() => {});
      if (billable) {
        const c = await db.outreachCampaign.findUnique({ where: { id: cb.campaignId } }).catch(() => null);
        if (c) await db.outreachCampaign.update({ where: { id: c.id }, data: { revenueCents: { increment: c.bidCents } } }).catch(() => {});
      }
    }
  }
  return xml(`<Hangup/>`);
}
