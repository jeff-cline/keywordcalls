import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, setSetting } from "@/lib/settings";
import { jdiConfigured, jdiScrub, jdiUploadAudioFromUrl, jdiCreateCampaign } from "@/lib/jdi";

export const runtime = "nodejs";

// Leave the demo voicemail — TRUE RINGLESS via JDI (no ring), scrubbed against the DNC blacklist.
// Callbacks still route through our Twilio number (cCallback) so tracking + passthrough stay intact.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  if (!(await jdiConfigured())) return NextResponse.json({ error: "Ringless (JDI) not configured yet." }, { status: 400 });

  const { numbers } = (await req.json().catch(() => ({}))) as { numbers?: unknown };
  const cfg = await getSettings(["demoAudioUrl", "demoNumber", "demoJdiWav", "demoJdiWavSrc"]);
  if (!cfg.demoAudioUrl) return NextResponse.json({ error: "Record a voicemail first." }, { status: 400 });
  if (!cfg.demoNumber) return NextResponse.json({ error: "Get a demo call-back number first." }, { status: 400 });

  const list = String(numbers || "").split(/[\n,;]+/).map((x) => x.replace(/[^\d]/g, "")).filter((x) => x.length >= 10).slice(0, 50);
  if (!list.length) return NextResponse.json({ error: "Add at least one phone number." }, { status: 400 });

  // 1) DNC scrub
  const { kept, removed } = await jdiScrub(list);
  if (!kept.length) return NextResponse.json({ error: "All numbers are on the DNC blacklist — nothing to send." }, { status: 400 });

  // 2) Ensure our recording is in JDI's audio library (cache by source URL)
  let wav = cfg.demoJdiWav;
  if (!wav || cfg.demoJdiWavSrc !== cfg.demoAudioUrl) {
    wav = (await jdiUploadAudioFromUrl(cfg.demoAudioUrl)) || "";
    if (wav) { await setSetting("demoJdiWav", wav); await setSetting("demoJdiWavSrc", cfg.demoAudioUrl); }
  }
  if (!wav) return NextResponse.json({ error: "Could not load the recording into the ringless system." }, { status: 502 });

  // 3) Create the ringless campaign (auto-start, high throttle for a live demo)
  const r = await jdiCreateCampaign({
    name: `KWC Demo ${Date.now().toString().slice(-6)}`,
    wavUrl: wav, callback: cfg.demoNumber.replace(/\D/g, ""), numbers: kept,
    throttle: 500, autoStart: true, timezone: "America/Chicago",
  });
  if (!r.ok) return NextResponse.json({ error: r.error || "Ringless campaign failed." }, { status: 502 });

  // 4) Log to the live board + the persistent Demoed list
  for (const n of kept) {
    const e164 = "+1" + n.slice(-10);
    await db.demoEvent.create({ data: { kind: "drop", phone: e164, note: "ringless voicemail sent" } }).catch(() => {});
    const c = await db.listContact.findFirst({ where: { OR: [{ phone: { contains: n.slice(-10) } }, { altPhones: { contains: n.slice(-10) } }] } }).catch(() => null);
    const appended = c ? { name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, city: c.city, state: c.state, zip: c.zip } : {};
    await db.demoContact.upsert({ where: { phone: e164 }, update: { timesDemoed: { increment: 1 }, lastDemoedAt: new Date(), ...appended }, create: { phone: e164, ...appended } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, placed: kept.length, scrubbed: removed.length, campaignId: r.campaignId });
}
