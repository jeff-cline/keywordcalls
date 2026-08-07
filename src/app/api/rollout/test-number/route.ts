import { NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { getTwilioCfg, searchNumbers, provisionNumber, releaseNumber } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// God: drop the previous test number and buy a fresh one, so every test call reaches the buyer from a
// number Ringba has never seen (it blocks duplicate caller IDs). Returns the new number.
export async function POST() {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
  return NextResponse.json({ ok: true, number: bought.number });
}
