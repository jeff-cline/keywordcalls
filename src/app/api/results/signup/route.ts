import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendCoreEmail } from "@/lib/core";
import { resultsFor, usd } from "@/lib/results";

export const runtime = "nodejs";
const BASE = "https://keywordcalls.com";

// Get Results: capture enough to create an account, store their LTV, email a welcome + results link.
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  const password = String(b.password || "");
  const ltvCents = Math.max(0, Math.round(parseFloat(String(b.ltvDollars || "0")) * 100) || 0);
  if (!email.includes("@")) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Pick a password (6+ characters)." }, { status: 400 });

  const [first, ...rest] = name.split(" ");
  let acct = await db.account.findUnique({ where: { email }, include: { customer: true } });
  let token = acct?.customer?.resultsToken || randomBytes(9).toString("base64url");

  if (!acct) {
    const created = await db.account.create({ data: {
      email, passwordHash: await hashPassword(password), role: "customer",
      firstName: first || "", lastName: rest.join(" "),
      refSlug: (first || "lead").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + randomBytes(3).toString("hex"),
    } });
    await db.customer.create({ data: { accountId: created.id, ltvCents, resultsToken: token } });
    acct = await db.account.findUnique({ where: { id: created.id }, include: { customer: true } });
  } else {
    await db.customer.update({ where: { accountId: acct.id }, data: { ltvCents, resultsToken: token } }).catch(() => {});
  }

  const r = resultsFor(ltvCents);
  const url = `${BASE}/results?t=${token}`;
  sendCoreEmail(email, "Your KeywordCalls account & results 🚀", `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#1b2a8f;padding:20px 24px;border-radius:12px 12px 0 0"><span style="color:#fff;font-weight:800;font-size:18px">KeywordCalls 🚀</span></div>
      <div style="border:1px solid #e6e8ee;border-top:0;padding:24px;border-radius:0 0 12px 12px">
        <p>Hi ${first || "there"},</p>
        <p>Your account is set up. Your username is <b>${email}</b> — log in anytime at ${BASE}/login.</p>
        <p>Based on a lifetime value of <b>${usd(ltvCents)}</b>, your estimated results: <b>${r.calls} calls → ${usd(r.revenueCents)}</b> for <b>${usd(r.costCents)}</b> = <b>${r.roas.toFixed(1)}× ROAS</b>.</p>
        <p><a href="${url}" style="display:inline-block;background:#ff7a1a;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">View your results &amp; download the PDF →</a></p>
      </div>
    </div>`, "results_welcome").catch(() => {});

  return NextResponse.json({ ok: true, token, url });
}
