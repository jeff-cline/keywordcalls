import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { coreUpload } from "@/lib/core";
import { setSetting } from "@/lib/settings";
import { convertToMp3 } from "@/lib/audio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file." }, { status: 400 });
  // Twilio can only play mp3/wav — convert the browser's webm.
  const mp3 = await convertToMp3(Buffer.from(await file.arrayBuffer()));
  if (!mp3) return NextResponse.json({ error: "Could not process the recording." }, { status: 502 });
  const url = await coreUpload(new Blob([new Uint8Array(mp3)], { type: "audio/mpeg" }), "demo-voicemail.mp3", "keywordcalls demo vm");
  if (!url) return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  await setSetting("demoAudioUrl", url);
  return NextResponse.json({ ok: true, url });
}
