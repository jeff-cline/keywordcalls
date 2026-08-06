import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resultsPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Download the branded results PDF (by token, or by ltv for the pre-signup preview).
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const token = u.searchParams.get("t") || "";
  const ltvQ = parseFloat(u.searchParams.get("ltv") || "0");
  let name = "your business", ltvCents = Math.round(ltvQ * 100) || 0;
  if (token) {
    const c = await db.customer.findFirst({ where: { resultsToken: token }, include: { account: true } });
    if (c) { name = `${c.account.firstName} ${c.account.lastName}`.trim() || "your business"; ltvCents = c.ltvCents; }
  }
  const pdf = await resultsPdf(name, ltvCents);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="keywordcalls-results.pdf"` } });
}
