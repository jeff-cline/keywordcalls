import { NextResponse } from "next/server";
import { getSession, createSession, clearSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Return to the staff account after impersonating.
export async function POST() {
  const s = await getSession();
  if (!s?.imp) return NextResponse.json({ error: "Not impersonating." }, { status: 400 });
  const staff = await db.account.findUnique({ where: { id: s.imp } });
  if (!staff) { await clearSession(); return NextResponse.json({ ok: true, redirect: "/login" }); }
  await createSession(staff);
  return NextResponse.json({ ok: true, redirect: "/admin/customers" });
}
