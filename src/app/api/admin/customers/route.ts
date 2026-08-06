import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditBalance } from "@/lib/money";
import { activateCustomer } from "@/lib/activate";
import { releaseByCustomer } from "@/lib/numbers";
import { pushLeadToCore } from "@/lib/core";
import { areaCodeOf } from "@/lib/twilio";

export const runtime = "nodejs";

function slugify(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "customer";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i}`;
    const hit = await db.account.findUnique({ where: { refSlug: slug } }).catch(() => null);
    if (!hit) return slug;
  }
  return `${root}-${Date.now()}`;
}

// God/admin: create a customer account + campaign from data we collected, optionally fund & activate.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(b.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  const exists = await db.account.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "An account with that email already exists." }, { status: 400 });

  const firstName = String(b.firstName || "").trim();
  const lastName = String(b.lastName || "").trim();
  const phone = String(b.phone || "").trim();
  const tempPassword = String(b.tempPassword || "").trim() || "TEMP!234";
  const keywords = Array.isArray(b.keywords) ? (b.keywords as unknown[]).map(String) : [];
  const geoStates = Array.isArray(b.geoStates) ? (b.geoStates as unknown[]).map(String) : [];
  const geoZips = Array.isArray(b.geoZips) ? (b.geoZips as unknown[]).map(String) : [];
  const geoExcludeStates = Array.isArray(b.geoExcludeStates) ? (b.geoExcludeStates as unknown[]).map(String) : [];
  const hours = (b.hours && typeof b.hours === "object") ? b.hours : {};
  const bidsIn = (b.bids && typeof b.bids === "object") ? (b.bids as Record<string, unknown>) : {};
  const bidsCents: Record<string, number> = {};
  for (const [k, v] of Object.entries(bidsIn)) { const n = Math.round(parseFloat(String(v)) * 100); if (n > 0) bidsCents[k] = n; }
  const routingNumber = String(b.routingNumber || "").trim();
  const fundCents = Math.max(0, Math.round(parseFloat(String(b.fundDollars || "0")) * 100) || 0);
  const activate = b.activate === true;

  const account = await db.account.create({
    data: {
      email, passwordHash: await hashPassword(tempPassword), role: "customer",
      firstName, lastName, phone,
      city: String(b.city || ""), state: String(b.state || ""), zip: String(b.zip || ""),
      mustChangePassword: true, refSlug: await uniqueSlug(slugify(`${firstName}-${lastName}`) || slugify(email.split("@")[0])),
    },
  });

  const customer = await db.customer.create({
    data: {
      accountId: account.id,
      keywords: JSON.stringify(keywords),
      geoType: String(b.geoType || "local"),
      geoStates: JSON.stringify(geoStates),
      geoZips: JSON.stringify(geoZips),
      geoExcludeStates: JSON.stringify(geoExcludeStates),
      hours: JSON.stringify(hours),
      routingNumber,
      planId: String(b.planId || ""),
      bidsJson: JSON.stringify(bidsCents),
      areaCode: areaCodeOf(phone) || areaCodeOf(routingNumber),
      status: "new",
    },
  });

  if (fundCents > 0) await creditBalance(customer.id, fundCents, "adjustment", `Admin funding by ${s!.email}`);

  let activation: { ok: boolean; number?: string; error?: string } | null = null;
  if (activate) activation = await activateCustomer(customer.id);

  pushLeadToCore({ name: `${firstName} ${lastName}`.trim(), email, phone, notes: `keywordcalls customer created by ${s!.email}${activate ? " + activated" : ""}`, creatorRef: "keywordcalls-admin" });

  return NextResponse.json({ ok: true, accountId: account.id, customerId: customer.id, tempPassword, activation });
}

// God/admin: act on an existing customer — activate (start the campaign), pause, or credit funds.
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const customerId = String(b.customerId || "");
  const action = String(b.action || "");
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  if (action === "activate") {
    const r = await activateCustomer(customer.id);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (action === "pause") {
    // Paused campaigns aren't in use → free the number back to the pool (kept + seasoned for reuse).
    await releaseByCustomer(customer.id);
    await db.customer.update({ where: { id: customer.id }, data: { status: "paused", twilioNumber: "", twilioNumberSid: "" } });
    return NextResponse.json({ ok: true });
  }
  if (action === "resume") {
    // Reacquire — the pool hands back the same seasoned number for this money word if it's still free.
    const r = await activateCustomer(customer.id, { notify: false });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (action === "credit") {
    const cents = Math.round(parseFloat(String(b.dollars || "0")) * 100) || 0;
    if (!cents) return NextResponse.json({ error: "Amount required." }, { status: 400 });
    const r = await creditBalance(customer.id, cents, "adjustment", `Admin ${cents < 0 ? "debit" : "credit"} by ${s!.email}`);
    return NextResponse.json({ ok: true, balance: r.balance });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
