import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function handle() {
  const row = await db.setting.findUnique({ where: { key: "demoAudioUrl" } });
  const url = row?.value || "";
  if (url) return xml(`<Play>${esc(url)}</Play>`);
  return xml(`<Say voice="Polly.Joanna-Neural">This is a KeywordCalls demo voicemail. Call us back to see high intent calls delivered live.</Say>`);
}
export async function GET() { return handle(); }
export async function POST() { return handle(); }
