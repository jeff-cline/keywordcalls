import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { e164 } from "@/lib/twilio";
import { isWithinHours } from "@/lib/hours";
import { getSetting } from "@/lib/settings";
import { bumpCallsIn } from "@/lib/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BASE = "https://keywordcalls.com";
function xml(body: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
function parse<T>(s: string, d: T): T { try { return JSON.parse(s) as T; } catch { return d; } }

// Twilio Voice webhook for a customer's tracking number. Routes the caller to their phone if the
// account is live, within call hours, and has enough balance to cover their bid — else politely declines.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const to = e164(String(form?.get("To") || ""));
  const from = String(form?.get("From") || "");
  const callSid = String(form?.get("CallSid") || "");

  const customer = await db.customer.findFirst({ where: { twilioNumber: to } });
  if (!customer) return xml(`<Say voice="Polly.Joanna-Neural">This number is not in service.</Say><Hangup/>`);

  const kws = parse<string[]>(customer.keywords, []);
  const keyword = kws[0] || "";
  const bids = parse<Record<string, number>>(customer.bidsJson, {});
  let bidCents = bids[keyword] || 0;
  if (!bidCents && keyword) { const k = await db.keyword.findUnique({ where: { name: keyword } }).catch(() => null); bidCents = k?.priceCents || 0; }

  const open = isWithinHours(parse(customer.hours, {}));
  const funded = bidCents > 0 && customer.balanceCents >= bidCents;

  if (!open) return xml(`<Say voice="Polly.Joanna-Neural">Thanks for calling. We're currently outside our calling hours — please try again later.</Say><Hangup/>`);
  if (customer.status === "paused" || !funded) return xml(`<Say voice="Polly.Joanna-Neural">Thanks for calling. This line is temporarily unavailable. Please try again soon.</Say><Hangup/>`);

  const dest = e164(customer.routingNumber);
  if (!dest || dest.length < 11) return xml(`<Say voice="Polly.Joanna-Neural">We're sorry, this line isn't set up yet.</Say><Hangup/>`);

  await db.call.create({ data: { customerId: customer.id, callSid, fromNumber: from, toNumber: to, keyword, status: "in-progress" } }).catch(() => {});
  await bumpCallsIn(to); // seasoned-number stats
  const action = `${BASE}/api/calls/dial-status?sid=${encodeURIComponent(callSid)}&bid=${bidCents}`;
  // CALLER-ID PASSTHROUGH — the buyer must see the CONSUMER's real number (from), never our tracking number.
  const callerId = from || to;
  return xml(`<Dial timeout="25" callerId="${callerId}" record="record-from-answer-dual" recordingStatusCallback="${BASE}/api/calls/recording?sid=${encodeURIComponent(callSid)}" action="${action}" method="POST"><Number>${dest}</Number></Dial>`);
}
