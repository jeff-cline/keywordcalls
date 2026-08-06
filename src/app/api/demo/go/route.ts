import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getTwilioCfg, placeCallTwiml } from "@/lib/twilio";

export const runtime = "nodejs";
const BASE = "https://keywordcalls.com";

// Leave the demo voicemail on the entered numbers — FROM the locked demo number (never 1-800-MEDIGAP).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const { numbers } = (await req.json().catch(() => ({}))) as { numbers?: unknown };
  const cfg = await getSettings(["demoAudioUrl", "demoNumber"]);
  if (!cfg.demoAudioUrl) return NextResponse.json({ error: "Record a voicemail first." }, { status: 400 });
  if (!cfg.demoNumber) return NextResponse.json({ error: "Get a demo call-back number first." }, { status: 400 });
  const tw = await getTwilioCfg();
  if (!tw) return NextResponse.json({ error: "Telephony not configured." }, { status: 400 });

  const list = String(numbers || "").split(/[\n,;]+/).map((x) => x.replace(/[^\d+]/g, "")).filter((x) => x.replace(/\D/g, "").length >= 10).slice(0, 50);
  if (!list.length) return NextResponse.json({ error: "Add at least one phone number." }, { status: 400 });

  // Voicemail-ONLY: Twilio detects the machine and only plays after the beep. Human → hang up.
  // The real outcome (voicemail left vs not connected) is logged by /api/demo/status.
  let placed = 0;
  for (const n of list) {
    const r = await placeCallTwiml(n, `${BASE}/api/demo/drop-twiml`, cfg.demoNumber, tw, { amd: true, statusCallback: `${BASE}/api/demo/status?to=${encodeURIComponent(n)}` });
    if (r.ok) placed++;
    // Persist to the ongoing "Demoed" list with any appended data we have.
    const digits = n.replace(/\D/g, "").slice(-10);
    const c = digits ? await db.listContact.findFirst({ where: { OR: [{ phone: { contains: digits } }, { altPhones: { contains: digits } }] } }).catch(() => null) : null;
    const appended = c ? { name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, city: c.city, state: c.state, zip: c.zip } : {};
    await db.demoContact.upsert({
      where: { phone: n },
      update: { timesDemoed: { increment: 1 }, lastDemoedAt: new Date(), ...appended },
      create: { phone: n, ...appended },
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, placed, attempted: list.length });
}
