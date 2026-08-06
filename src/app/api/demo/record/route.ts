import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { coreUpload } from "@/lib/core";
import { setSetting } from "@/lib/settings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file." }, { status: 400 });
  const url = await coreUpload(file, "demo-voicemail.webm", "keywordcalls demo vm");
  if (!url) return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  await setSetting("demoAudioUrl", url);
  return NextResponse.json({ ok: true, url });
}
