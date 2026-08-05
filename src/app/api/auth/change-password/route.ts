import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const pw = String(b.password || "");
  if (pw.length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  const acct = await db.account.update({ where: { id: s.uid }, data: { passwordHash: await hashPassword(pw), mustChangePassword: false } });
  await createSession(acct); // refresh token
  return NextResponse.json({ ok: true, role: acct.role });
}
