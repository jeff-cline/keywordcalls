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

// TwiML URL that plays the campaign's recorded audio (outbound drop or follow-up).
export function dropTwimlUrl(campaignId: string, type: "outbound" | "followup"): string {
  return `${BASE}/api/campaigns/drop-twiml?c=${encodeURIComponent(campaignId)}&type=${type}`;
}

// Place a single test call to a number, playing the campaign's outbound recording.
export async function testDrop(campaignId: string, toNumber: string): Promise<{ ok: boolean; error?: string }> {
  return coreCall(toNumber, { twimlUrl: dropTwimlUrl(campaignId, "outbound") });
}
