import { NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { computeAdminStats } from "@/lib/adminStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real-time economics for the admin dashboard (polled by AdminStats).
export async function GET() {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json(await computeAdminStats());
}
