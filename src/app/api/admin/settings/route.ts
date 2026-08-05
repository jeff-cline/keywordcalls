import { NextRequest, NextResponse } from "next/server";
import { getSession, isGod } from "@/lib/auth";
import { setSetting } from "@/lib/settings";

const ALLOWED = new Set(["stripeSecretKey", "stripePublishableKey", "stripeWebhookSecret", "notifyEmail", "minFundCents", "setupFeeCents", "calendlyUrl"]);

// Save integration keys + knobs. God only. Secrets are write-only (never returned).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isGod(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}) as any);
  let saved = 0;
  for (const [k, v] of Object.entries(b)) {
    if (!ALLOWED.has(k)) continue;
    // skip masked/blank secret fields so we don't overwrite a stored key with empty
    if (typeof v !== "string") continue;
    if (["stripeSecretKey", "stripeWebhookSecret"].includes(k) && (v === "" || v.includes("•"))) continue;
    await setSetting(k, v.slice(0, 500));
    saved++;
  }
  return NextResponse.json({ ok: true, saved });
}
