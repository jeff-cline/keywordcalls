import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}) as any);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  const acct = await db.account.findUnique({ where: { email } });
  if (!acct || !acct.active || !(await verifyPassword(password, acct.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  await createSession(acct);
  return NextResponse.json({ ok: true, mustChangePassword: acct.mustChangePassword, role: acct.role });
}
