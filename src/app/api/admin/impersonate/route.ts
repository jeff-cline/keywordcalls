import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff, createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// God/staff: become a customer to see their account. Session is tagged with imp=<staff uid>
// so they can exit back. Short-lived (2h).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (s!.imp) return NextResponse.json({ error: "Already impersonating." }, { status: 400 });
  const { accountId } = (await req.json().catch(() => ({}))) as { accountId?: string };
  const target = await db.account.findUnique({ where: { id: String(accountId || "") } });
  if (!target || target.role !== "customer") return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  await createSession(target, s!.uid);
  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
