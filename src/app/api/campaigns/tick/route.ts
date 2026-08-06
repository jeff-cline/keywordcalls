import { NextRequest, NextResponse } from "next/server";
import { tickCampaigns } from "@/lib/runner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every minute by a box cron. Advances all ON campaigns by one minute of paced work.
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-tick-key") || new URL(req.url).searchParams.get("key") || "";
  if (!process.env.TICK_KEY || key !== process.env.TICK_KEY) return NextResponse.json({ ok: false }, { status: 401 });
  const r = await tickCampaigns();
  return NextResponse.json({ ok: true, ...r });
}
