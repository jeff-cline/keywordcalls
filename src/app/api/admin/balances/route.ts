import { NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { quickBalances } from "@/lib/accounting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight balances for the top-nav widget (Twilio $ + JDI credits).
export async function GET() {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json(await quickBalances());
}
