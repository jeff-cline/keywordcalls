import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Append what we know about a callback lead (from our imported data / CORE) for the demo.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("phone") || "";
  const p = raw.replace(/[^\d+]/g, "");
  const digits = p.replace(/\D/g, "").slice(-10);
  const c = digits ? await db.listContact.findFirst({ where: { OR: [{ phone: { contains: digits } }, { altPhones: { contains: digits } }] } }) : null;
  if (!c) return NextResponse.json({ ok: true, found: false, phone: raw });
  return NextResponse.json({ ok: true, found: true, phone: raw, lead: { name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, city: c.city, state: c.state, zip: c.zip } });
}
