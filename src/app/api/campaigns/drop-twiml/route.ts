import { NextRequest } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function xml(b: string) { return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${b}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// TwiML played to the answering machine — plays the recorded audio, else speaks the fallback message.
export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
async function handle(req: NextRequest) {
  const u = new URL(req.url);
  const id = u.searchParams.get("c") || "";
  const type = u.searchParams.get("type") === "followup" ? "followup" : "outbound";
  const c = await db.outreachCampaign.findUnique({ where: { id } });
  if (!c) return xml(`<Hangup/>`);
  const audio = type === "followup" ? c.followupAudioUrl : c.outboundAudioUrl;
  const fallback = type === "followup" ? c.followupMessage : "Hello, this is a message for you. Please call us back.";
  if (audio) return xml(`<Play>${esc(audio)}</Play>`);
  return xml(`<Say voice="Polly.Joanna-Neural">${esc(fallback)}</Say>`);
}
