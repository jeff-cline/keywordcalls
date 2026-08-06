import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const { number } = (await req.json().catch(() => ({}))) as { number?: unknown };
  const digits = String(number || "").replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a valid number." }, { status: 400 });
  await setSetting("demoCallbackTarget", digits);
  return NextResponse.json({ ok: true, number: digits });
}
