import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushLeadToCore } from "@/lib/core";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}) as any);
  const name = String(b.name || "").slice(0, 200);
  const email = String(b.email || "").slice(0, 200);
  if (!name.trim() || !email.trim()) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  const kind = ["press", "investor", "partnership", "advertise", "sponsor"].includes(b.kind) ? b.kind : "contact";
  const lead = await db.contactLead.create({
    data: { kind, name, email, phone: String(b.phone || "").slice(0, 40), company: String(b.company || "").slice(0, 200), website: String(b.website || "").slice(0, 300), reason: String(b.reason || "").slice(0, 2000) },
  });
  // land it in the shared CORE CRM/JV (best-effort)
  void pushLeadToCore({ name, email, phone: b.phone, notes: `[keywordcalls ${kind}] ${b.company || ""} ${b.website || ""} — ${b.reason || ""}`.trim(), creatorRef: "keywordcalls" });
  return NextResponse.json({ ok: true, id: lead.id });
}
