import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { getTwilioCfg, searchNumbers, provisionNumber } from "@/lib/twilio";
export const runtime = "nodejs";
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const cur = await getSettings(["demoNumber"]);
  if (cur.demoNumber) return NextResponse.json({ ok: true, number: cur.demoNumber });
  const cfg = await getTwilioCfg();
  if (!cfg) return NextResponse.json({ error: "Telephony not configured." }, { status: 400 });
  const nums = await searchNumbers("", cfg);
  if (!nums.length) return NextResponse.json({ error: "No numbers available." }, { status: 400 });
  const bought = await provisionNumber(nums[0], cfg, "/api/demo/inbound");
  if (!bought) return NextResponse.json({ error: "Purchase failed." }, { status: 502 });
  await setSetting("demoNumber", bought.number);
  await setSetting("demoNumberSid", bought.sid);
  return NextResponse.json({ ok: true, number: bought.number });
}
