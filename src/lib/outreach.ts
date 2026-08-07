import { isWithinHours } from "@/lib/hours";
import { coreCall } from "@/lib/core";

const BASE = "https://keywordcalls.com";

type Campaign = {
  id: string; listId: string | null; bidCents: number; states: string; mode?: string; routingNumber?: string;
  outboundAudioUrl: string; followupAudioUrl: string; hoursStart: string; hoursEnd: string; tz: string;
};

// What still needs to be set before a campaign can go live.
export function campaignSetup(c: Campaign): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.listId) missing.push("a list");
  if (!c.bidCents) missing.push("a bid");
  let states: string[] = []; try { states = JSON.parse(c.states); } catch {}
  if (!states.length) missing.push("target states");
  if (c.mode !== "email_only" && !c.outboundAudioUrl) missing.push("outbound voicemail recording");
  if (!c.routingNumber) missing.push("a callback routing number");
  // follow-up recording is optional (ringless delivery handles the drop)
  return { ok: missing.length === 0, missing };
}

// Campaigns run Mon–Fri within their hours, in their timezone (default EST).
export function campaignOpen(c: { hoursStart: string; hoursEnd: string; tz: string }, now = new Date()): boolean {
  return isWithinHours({ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start: c.hoursStart, end: c.hoursEnd }, now, c.tz);
}

// Convert a wall-clock time in `tz` (y, monthIdx, day, h, min) to an epoch (ms), DST-correct.
function wallToEpoch(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo, d, h, mi);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p: Record<string, string> = {};
  for (const x of dtf.formatToParts(new Date(guess))) if (x.type !== "literal") p[x.type] = x.value;
  let hh = parseInt(p.hour, 10); if (hh === 24) hh = 0;
  const asUTC = Date.UTC(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10), hh, parseInt(p.minute, 10), parseInt(p.second, 10));
  return guess - (asUTC - guess);
}

// Epoch (ms) of the next moment the send window opens (next Mon–Fri at hoursStart, in the campaign's tz).
export function nextWindowOpen(c: { hoursStart: string; tz: string }, now = new Date()): number | null {
  const [h, m] = (c.hoursStart || "08:30").split(":").map((n) => parseInt(n, 10));
  const tz = c.tz || "America/New_York";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  for (let add = 0; add < 9; add++) {
    const base = new Date(now.getTime() + add * 86400000);
    const dp = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
    const parts: Record<string, string> = {};
    for (const x of dp.formatToParts(base)) if (x.type !== "literal") parts[x.type] = x.value;
    if (!weekdays.includes(parts.weekday)) continue;
    const epoch = wallToEpoch(parseInt(parts.year, 10), parseInt(parts.month, 10) - 1, parseInt(parts.day, 10), h || 0, m || 0, tz);
    if (epoch > now.getTime()) return epoch;
  }
  return null;
}

// TwiML URL that plays the campaign's recorded audio (outbound drop or follow-up).
export function dropTwimlUrl(campaignId: string, type: "outbound" | "followup"): string {
  return `${BASE}/api/campaigns/drop-twiml?c=${encodeURIComponent(campaignId)}&type=${type}`;
}

// Place a single test call to a number, playing the campaign's outbound recording.
export async function testDrop(campaignId: string, toNumber: string): Promise<{ ok: boolean; error?: string }> {
  return coreCall(toNumber, { twimlUrl: dropTwimlUrl(campaignId, "outbound") });
}
