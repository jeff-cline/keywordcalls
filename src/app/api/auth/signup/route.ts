import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { pushLeadToCore } from "@/lib/core";

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
  if (await db.account.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with that email already exists — log in instead." }, { status: 409 });

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

  await db.customer.create({
    data: {
      accountId: acct.id,
      keywords: JSON.stringify(Array.isArray(b.keywords) ? b.keywords : []),
      geoType: ["local", "statewide", "regional", "national"].includes(b.geoType) ? b.geoType : "local",
      geoStates: JSON.stringify(Array.isArray(b.geoStates) ? b.geoStates : []),
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
