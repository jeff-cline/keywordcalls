import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { creditBalance } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import { getTwilioCfg, callPriceCents } from "@/lib/twilio";
import { pushLeadToCore } from "@/lib/core";
import { checkLowBalance } from "@/lib/lowbalance";
import { bumpMonetized } from "@/lib/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(body: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } }); }

// Fires when the dialed customer leg ends → bill their bid if the call connected long enough.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") || "";
  const bid = parseInt(url.searchParams.get("bid") || "0", 10) || 0;
  const form = await req.formData().catch(() => null);
  const dialStatus = String(form?.get("DialCallStatus") || "");
  const dialDur = parseInt(String(form?.get("DialCallDuration") || "0"), 10) || 0;

  const call = await db.call.findUnique({ where: { callSid: sid } });
  if (call) {
    const billableSeconds = parseInt(await getSetting("billableSeconds", "60"), 10);
    const shouldBill = dialStatus === "completed" && dialDur >= billableSeconds && !call.billed && bid > 0;
    const data: Record<string, unknown> = { status: dialStatus, connectSec: dialDur, durationSec: dialDur };
    if (shouldBill) {
      const { already } = await creditBalance(call.customerId, -bid, "charge", `Call from ${call.fromNumber}${call.keyword ? ` · ${call.keyword}` : ""}`, `call:${sid}`);
      if (!already) { data.billed = true; data.chargedCents = bid; }
    }
    await db.call.update({ where: { id: call.id }, data }).catch(() => {});
    if (data.billed) { await bumpMonetized(call.toNumber).catch(() => {}); await checkLowBalance(call.customerId).catch(() => {}); }

    // best-effort: real Twilio cost + Core data-append on the caller (God-only visibility)
    (async () => {
      const cfg = await getTwilioCfg();
      if (cfg) { const c = await callPriceCents(sid, cfg); if (c != null) await db.call.update({ where: { id: call.id }, data: { costCents: c } }).catch(() => {}); }
      pushLeadToCore({ phone: call.fromNumber, notes: `keywordcalls inbound → ${call.keyword} (append)`, creatorRef: "keywordcalls-call" });
    })().catch(() => {});
  }
  return xml(`<Hangup/>`);
}
