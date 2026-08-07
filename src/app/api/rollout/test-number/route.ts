import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { getTwilioCfg, searchNumbers, provisionNumber, releaseNumber } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// God: drop the previous test number and buy a fresh one, so every test call reaches the buyer from a
// number Ringba has never seen (it blocks duplicate caller IDs). Logs a TestCall (saving the number we
// dialed from + the buyer) so you can look it up later. Returns the new number + the test-call id.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { campaignId?: string };
  const cfg = await getTwilioCfg();
  if (!cfg) return NextResponse.json({ error: "Telephony not configured." }, { status: 400 });

  // 1) Release the previous test number (if any) so we don't accumulate.
  const prevSid = await getSetting("testNumberSid");
  if (prevSid) await releaseNumber(prevSid, cfg).catch(() => {});

  // 2) Buy a brand-new number.
  const nums = await searchNumbers("", cfg);
  if (!nums.length) return NextResponse.json({ error: "No numbers available to buy right now." }, { status: 502 });
  const bought = await provisionNumber(nums[0], cfg, "/api/rollout/test-voice");
  if (!bought) return NextResponse.json({ error: "Number purchase failed at Twilio." }, { status: 502 });

  await setSetting("testNumber", bought.number);
  await setSetting("testNumberSid", bought.sid);

  // 3) Log the test call so the dialed-from number + recording are saved for later.
  const c = body.campaignId ? await db.outreachCampaign.findUnique({ where: { id: body.campaignId } }) : await db.outreachCampaign.findFirst({ where: { rolloutGroup: "A" } });
  const tc = await db.testCall.create({ data: { fromNumber: bought.number, toNumber: c?.routingNumber || "", campaignId: c?.id || "", campaignName: c?.name || "" } }).catch(() => null);
  return NextResponse.json({ ok: true, number: bought.number, testCallId: tc?.id || "" });
}
