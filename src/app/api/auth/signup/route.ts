import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { pushLeadToCore, sendCoreEmail } from "@/lib/core";

const BASE = "https://keywordcalls.com";
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "member";
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}) as any);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const firstName = String(b.firstName || "").trim();
  const lastName = String(b.lastName || "").trim();
  if (!email || !password || !firstName) return NextResponse.json({ error: "First name, email and password are required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  // Already have an account? Reset their password, email it, and send them to log in.
  const existing = await db.account.findUnique({ where: { email } });
  if (existing) {
    const temp = "Kwc-" + randomBytes(4).toString("hex");
    await db.account.update({ where: { id: existing.id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true } });
    sendCoreEmail(email, "Your KeywordCalls password was reset", `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#1b2a8f;padding:18px 22px;border-radius:12px 12px 0 0"><b style="color:#fff;font-size:17px">KeywordCalls 🚀</b></div>
        <div style="border:1px solid #e6e8ee;border-top:0;padding:22px;border-radius:0 0 12px 12px">
          <p>Hi ${existing.firstName || "there"},</p>
          <p>You already have an account with this email. We reset your password so you can get right back in:</p>
          <p>Username: <b>${email}</b><br>Temporary password: <b>${temp}</b></p>
          <p><a href="${BASE}/login" style="display:inline-block;background:#ff7a1a;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Log in →</a></p>
          <p style="font-size:12px;color:#667">You'll be asked to set a new password on login.</p>
        </div>
      </div>`, "password_reset").catch(() => {});
    return NextResponse.json({ existing: true, redirect: "/login", message: "You already have an account — we emailed you a password reset. Taking you to login…" });
  }

  // unique ref slug (firstname-lastname tracking link)
  let base = slugify(`${firstName}-${lastName}`);
  let refSlug = base, i = 1;
  while (await db.account.findUnique({ where: { refSlug } })) refSlug = `${base}-${++i}`;

  const acct = await db.account.create({
    data: {
      email, passwordHash: await hashPassword(password), role: "customer",
      firstName, lastName, phone: String(b.phone || "").slice(0, 40),
      city: String(b.city || "").slice(0, 100), state: String(b.state || "").slice(0, 40), zip: String(b.zip || "").slice(0, 20),
      refSlug,
    },
  });

  // referral attribution (from a /firstname-lastname tracking link)
  let referredBy: string | null = null;
  if (b.ref) { const r = await db.account.findUnique({ where: { refSlug: String(b.ref) } }).catch(() => null); referredBy = r?.id ?? null; }

  // bids: { keyword: dollars } → cents
  const bidsCents: Record<string, number> = {};
  if (b.bids && typeof b.bids === "object") for (const [k, v] of Object.entries(b.bids)) { const n = Math.round(parseFloat(String(v)) * 100); if (n > 0) bidsCents[k] = n; }

  await db.customer.create({
    data: {
      accountId: acct.id,
      keywords: JSON.stringify(Array.isArray(b.keywords) ? b.keywords : []),
      bidsJson: JSON.stringify(bidsCents),
      geoType: ["local", "statewide", "regional", "national"].includes(b.geoType) ? b.geoType : "local",
      geoStates: JSON.stringify(Array.isArray(b.geoStates) ? b.geoStates : []),
      geoZips: JSON.stringify(Array.isArray(b.geoZips) ? b.geoZips : []),
      geoExcludeStates: JSON.stringify(Array.isArray(b.geoExcludeStates) ? b.geoExcludeStates : []),
      hours: JSON.stringify(b.hours && typeof b.hours === "object" ? b.hours : {}),
      routingNumber: String(b.routingNumber || "").slice(0, 40),
      agreementSignedAt: b.agreed ? new Date() : null,
      referredBy,
    },
  });

  await createSession(acct);
  // notify you + land in the CORE CRM (best-effort; email wiring lands with the CORE key)
  void pushLeadToCore({ name: `${firstName} ${lastName}`.trim(), email, phone: b.phone, notes: `🚀 New keywordcalls account · keywords: ${(Array.isArray(b.keywords) ? b.keywords.join(", ") : "")} · ${b.city || ""} ${b.state || ""}`.trim(), creatorRef: "keywordcalls-signup" });

  return NextResponse.json({ ok: true });
}
