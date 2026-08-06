import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCsv, contactsFromRows } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Upload a CSV list to call/email. Parsed, named, and timestamped for reuse.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!isStaff(s)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file." }, { status: 400 });
  const name = String(form?.get("name") || file.name.replace(/\.csv$/i, "")).slice(0, 120);

  const text = await file.text();
  const rows = parseCsv(text);
  const contacts = contactsFromRows(rows);
  if (!contacts.length) return NextResponse.json({ error: "No usable rows (need a phone column)." }, { status: 400 });

  const list = await db.callList.create({ data: { name, source: file.name, rowCount: contacts.length } });
  for (let i = 0; i < contacts.length; i += 1000) {
    await db.listContact.createMany({ data: contacts.slice(i, i + 1000).map((c) => ({ ...c, listId: list.id })) });
  }
  return NextResponse.json({ ok: true, listId: list.id, count: contacts.length });
}
