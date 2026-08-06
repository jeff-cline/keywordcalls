import { db } from "@/lib/db";
import { getTwilioCfg, placeCallTwiml } from "@/lib/twilio";
import { acquireForCampaign } from "@/lib/numbers";
import { campaignOpen } from "@/lib/outreach";
import { sendCoreEmail } from "@/lib/core";

const BASE = "https://keywordcalls.com";
type Campaign = Awaited<ReturnType<typeof getCampaign>>;
function getCampaign(id: string) { return db.outreachCampaign.findUnique({ where: { id } }); }
function parseStates(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }

// Turn an outbound campaign ON: give it its own caller-ID / callback number, then start.
export async function activateOutbound(campaignId: string): Promise<{ ok: boolean; number?: string; error?: string }> {
  const c = await getCampaign(campaignId);
  if (!c) return { ok: false, error: "Campaign not found." };
  let number = c.campaignNumber;
  if (!number) {
    const got = await acquireForCampaign({ moneyWord: `campaign:${c.name}`, campaignId: c.id, campaignName: c.name, voicePath: "/api/campaigns/inbound" });
    if (!got.ok || !got.number) return { ok: false, error: got.error || "Could not get a number." };
    number = got.number;
    await db.outreachCampaign.update({ where: { id: c.id }, data: { campaignNumber: got.number, campaignNumberSid: got.sid || "" } });
  }
  await db.outreachCampaign.update({ where: { id: c.id }, data: { status: "on", startedAt: new Date(), finishedAt: null } });
  return { ok: true, number };
}

function emailHtml(c: NonNullable<Campaign>, firstName: string): string {
  const body = (c.emailBody || "We wanted to reach out. Reply or give us a call back.").split("\n").map((l) => `<p>${l}</p>`).join("");
  return `<p>Hi ${firstName || "there"},</p>${body}`;
}

// Place one voicemail-only drop (AMD) from the campaign's number.
async function drop(c: NonNullable<Campaign>, ocId: string, phone: string, cfg: { sid: string; token: string }) {
  const r = await placeCallTwiml(phone, `${BASE}/api/campaigns/drop-twiml?c=${c.id}&type=outbound`, c.campaignNumber, cfg, {
    amd: true, statusCallback: `${BASE}/api/campaigns/status?oc=${ocId}`,
  });
  await db.outreachCall.update({ where: { id: ocId }, data: { voiceDoneAt: new Date() } }).catch(() => {});
  if (r.ok) await db.outreachCampaign.update({ where: { id: c.id }, data: { dialedCount: { increment: 1 } } }).catch(() => {});
}

// Advance every ON campaign by one minute's worth of work. Reads each campaign fresh, so edits
// (states, throttle, mode, messages) and pause take effect on the very next tick.
export async function tickCampaigns(now = new Date()): Promise<{ processed: number }> {
  const live = await db.outreachCampaign.findMany({ where: { status: "on" } });
  const cfg = await getTwilioCfg();
  let processed = 0;

  for (const c of live) {
    if (!campaignOpen(c, now)) continue;             // outside its hours
    if (!c.listId || !c.campaignNumber || !cfg) continue;
    const wantsVoice = c.mode !== "email_only";
    const wantsEmail = c.mode !== "voice_only";
    if (wantsVoice && !c.outboundAudioUrl) continue; // no recording → can't drop
    let budget = Math.max(1, c.callsPerMin);         // voice drops this minute

    // 1) Due voice drops (voice_email delay elapsed) first.
    if (wantsVoice) {
      const due = await db.outreachCall.findMany({ where: { campaignId: c.id, voiceDoneAt: null, voiceAt: { lte: now } }, take: budget });
      for (const oc of due) { await drop(c, oc.id, oc.phone, cfg); budget--; processed++; if (budget <= 0) break; }
    }

    // 2) Start new contacts (paced by remaining budget), advancing the cursor.
    if (budget > 0) {
      const states = parseStates(c.states);
      const next = await db.listContact.findMany({
        where: { listId: c.listId, id: { gt: c.cursor }, ...(states.length ? { state: { in: states } } : {}) },
        orderBy: { id: "asc" }, take: budget,
      });
      if (next.length === 0) {
        const pending = await db.outreachCall.count({ where: { campaignId: c.id, voiceDoneAt: null } });
        if (pending === 0 && !c.finishedAt) await db.outreachCampaign.update({ where: { id: c.id }, data: { finishedAt: new Date() } }).catch(() => {});
      } else {
        for (const ct of next) {
          const oc = await db.outreachCall.create({ data: { campaignId: c.id, contactId: ct.id, phone: ct.phone } }).catch(() => null);
          if (!oc) continue;
          if (wantsEmail && ct.email) { const sent = await sendCoreEmail(ct.email, c.emailSubject || "A quick note from us", emailHtml(c, ct.firstName), "campaign"); if (sent) await db.outreachCall.update({ where: { id: oc.id }, data: { emailSentAt: new Date() } }).catch(() => {}); }
          if (c.mode === "voice_only") { await drop(c, oc.id, ct.phone, cfg); processed++; }
          else if (c.mode === "voice_email") { await db.outreachCall.update({ where: { id: oc.id }, data: { voiceAt: new Date(now.getTime() + c.emailDelayMin * 60000) } }).catch(() => {}); }
          processed++;
        }
        await db.outreachCampaign.update({ where: { id: c.id }, data: { cursor: next[next.length - 1].id } }).catch(() => {});
      }
    }
  }
  return { processed };
}
