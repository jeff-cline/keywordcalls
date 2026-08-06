import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Voicemail-ONLY: play the recording only when Twilio reports an answering machine. If a human
// (or anything unclear) answers, hang up immediately — we never talk to a live person.
async function handle(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const answeredBy = String(form?.get("AnsweredBy") || "");
  const isMachine = answeredBy.startsWith("machine");
  if (!isMachine) return xml(`<Hangup/>`);
  const row = await db.setting.findUnique({ where: { key: "demoAudioUrl" } });
  const url = row?.value || "";
  if (url) return xml(`<Play>${esc(url)}</Play>`);
  return xml(`<Say voice="Polly.Joanna-Neural">This is a KeywordCalls demo. Call us back to see high intent calls delivered live.</Say>`);
}
export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
