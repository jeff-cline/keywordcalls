import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const [events, drops, callbacks, notConnected, cfg] = await Promise.all([
    db.demoEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    db.demoEvent.count({ where: { kind: "drop" } }),
    db.demoEvent.count({ where: { kind: "callback" } }),
    db.demoEvent.count({ where: { kind: "notconnected" } }),
    getSettings(["demoNumber", "demoAudioUrl"]),
  ]);
  return NextResponse.json({ ok: true, drops, callbacks, notConnected, demoNumber: cfg.demoNumber || "", hasAudio: !!cfg.demoAudioUrl, events: events.map((e) => ({ id: e.id, kind: e.kind, phone: e.phone, note: e.note, at: e.createdAt })) });
}
