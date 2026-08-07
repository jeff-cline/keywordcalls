import { NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { makeVoiceToken } from "@/lib/twilioToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// God: mint a Twilio Voice access token so the browser can place the test call through your speakers.
export async function GET() {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const cfg = await getSettings(["twilioAccountSid", "voiceApiKeySid", "voiceApiKeySecret", "voiceTwimlAppSid"]);
  if (!cfg.voiceApiKeySid || !cfg.voiceApiKeySecret || !cfg.voiceTwimlAppSid) {
    return NextResponse.json({ error: "Browser calling isn't set up yet (missing Twilio API key / TwiML app)." }, { status: 400 });
  }
  const token = makeVoiceToken({
    accountSid: cfg.twilioAccountSid, apiKeySid: cfg.voiceApiKeySid, apiKeySecret: cfg.voiceApiKeySecret,
    twimlAppSid: cfg.voiceTwimlAppSid, identity: "god-tester",
  });
  return NextResponse.json({ token });
}
