import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { coreCall } from "@/lib/core";
export const runtime = "nodejs";
const BASE = "https://keywordcalls.com";
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const { numbers } = (await req.json().catch(() => ({}))) as { numbers?: unknown };
  const cfg = await getSettings(["demoAudioUrl"]);
  if (!cfg.demoAudioUrl) return NextResponse.json({ error: "Record a voicemail first." }, { status: 400 });
  const list = String(numbers || "").split(/[\n,;]+/).map((x) => x.replace(/[^\d+]/g, "")).filter((x) => x.replace(/\D/g, "").length >= 10).slice(0, 50);
  if (!list.length) return NextResponse.json({ error: "Add at least one phone number." }, { status: 400 });
  let left = 0;
  for (const n of list) {
    const r = await coreCall(n, { twimlUrl: `${BASE}/api/demo/drop-twiml` });
    if (r.ok) { left++; await db.demoEvent.create({ data: { kind: "drop", phone: n, note: "voicemail left" } }).catch(() => {}); }
  }
  return NextResponse.json({ ok: true, left, attempted: list.length });
}
