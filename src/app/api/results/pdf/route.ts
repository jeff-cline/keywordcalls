import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resultsPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Download the branded, interactive results PDF: LTV→ROAS + the real live-test data.
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const token = u.searchParams.get("t") || "";
  const ltvQ = parseFloat(u.searchParams.get("ltv") || "0");
  let name = "your business", ltvCents = Math.round(ltvQ * 100) || 0;
  if (token) {
    const c = await db.customer.findFirst({ where: { resultsToken: token }, include: { account: true } });
    if (c) { name = `${c.account.firstName} ${c.account.lastName}`.trim() || "your business"; ltvCents = c.ltvCents; }
  }
  if (!ltvCents) ltvCents = 300000;

  // Pull the live test data + appended names.
  const [events, contacts] = await Promise.all([
    db.demoEvent.findMany({ where: { kind: { in: ["drop", "callback"] } }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.demoContact.findMany({ select: { phone: true, name: true }, take: 500 }),
  ]);
  const nameByDigits = new Map<string, string>();
  for (const c of contacts) { const d = c.phone.replace(/\D/g, "").slice(-10); if (d) nameByDigits.set(d, c.name); }
  const nameFor = (phone: string) => nameByDigits.get(phone.replace(/\D/g, "").slice(-10)) || "";
  const drops = events.filter((e) => e.kind === "drop").map((e) => ({ phone: e.phone, name: nameFor(e.phone), at: e.createdAt }));
  const callbacks = events.filter((e) => e.kind === "callback").map((e) => ({ phone: e.phone, name: nameFor(e.phone), at: e.createdAt }));

  const pdf = await resultsPdf({ name, ltvCents, drops, callbacks });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="keywordcalls-results.pdf"` } });
}
