import { db } from "@/lib/db";
import { acquireForCampaign } from "@/lib/numbers";
import { campaignOpen } from "@/lib/outreach";
import { sendCoreEmail } from "@/lib/core";
import { jdiConfigured, jdiUploadAudioFromUrl, jdiCreateCampaign } from "@/lib/jdi";

type Campaign = Awaited<ReturnType<typeof getCampaign>>;
function getCampaign(id: string) { return db.outreachCampaign.findUnique({ where: { id } }); }
function parseStates(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }
function parseIds(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }
const RUN_DAYS = "1,2,3,4,5"; // Mon–Fri (JDI: 0=Sun)

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
  // Reset run progress so a re-launch starts fresh.
  await db.outreachCampaign.update({ where: { id: c.id }, data: { status: "on", startedAt: new Date(), finishedAt: null, jdiDone: false, jdiCampaignIds: "[]", emailCursor: "", emailDone: false } });
  return { ok: true, number };
}

function emailHtml(c: NonNullable<Campaign>, firstName: string): string {
  const body = (c.emailBody || "We wanted to reach out. Reply or give us a call back.").split("\n").map((l) => `<p>${l}</p>`).join("");
  return `<p>Hi ${firstName || "there"},</p>${body}`;
}

// Advance every ON campaign. VOICE → true ringless via JDI (paced by JDI within hours, DNC scrub ON
// for cold outreach). EMAIL → Zapmail, paced by this cron. Reads each campaign fresh, so edits + pause
// take effect on the next tick.
export async function tickCampaigns(now = new Date()): Promise<{ processed: number }> {
  const live = await db.outreachCampaign.findMany({ where: { status: "on" } });
  let processed = 0;

  for (const c of live) {
    if (!campaignOpen(c, now)) continue;
    if (!c.listId) continue;
    const states = parseStates(c.states);
    const stateWhere = states.length ? { state: { in: states } } : {};
    const wantsVoice = c.mode !== "email_only";
    const wantsEmail = c.mode !== "voice_only";

    // ---- VOICE: hand the whole eligible list to JDI once (ringless) ----
    if (wantsVoice && !c.jdiDone) {
      if (!c.outboundAudioUrl || !c.campaignNumber || !(await jdiConfigured())) {
        // can't run voice yet — leave jdiDone false so a later tick retries once set up
      } else {
        let wav = c.jdiWav;
        if (!wav) { wav = (await jdiUploadAudioFromUrl(c.outboundAudioUrl)) || ""; if (wav) await db.outreachCampaign.update({ where: { id: c.id }, data: { jdiWav: wav } }); }
        if (wav) {
          const contacts = await db.listContact.findMany({ where: { listId: c.listId, ...stateWhere, phone: { not: "" } }, select: { phone: true } });
          const numbers = [...new Set(contacts.map((x) => x.phone.replace(/\D/g, "")).filter((n) => n.length >= 10))];
          const CHUNK = 20000;
          const chunks: string[][] = [];
          for (let i = 0; i < numbers.length; i += CHUNK) chunks.push(numbers.slice(i, i + CHUNK));
          const perThrottle = Math.max(1, Math.round((c.callsPerMin * 60) / Math.max(1, chunks.length))); // split rate across chunks
          const ids = parseIds(c.jdiCampaignIds);
          for (let i = 0; i < chunks.length; i++) {
            const r = await jdiCreateCampaign({
              name: `${c.name.slice(0, 18)} ${i + 1}`, wavUrl: wav, callback: c.campaignNumber.replace(/\D/g, ""), numbers: chunks[i],
              throttle: perThrottle, startTime: c.hoursStart, stopTime: c.hoursEnd, runDays: RUN_DAYS, timezone: c.tz,
              stateCheck: true, performance: true, autoStart: true, // DNC / litigator scrub ON for cold outreach
            });
            if (r.ok && r.campaignId) ids.push(r.campaignId);
          }
          await db.outreachCampaign.update({ where: { id: c.id }, data: { jdiCampaignIds: JSON.stringify(ids), jdiDone: true, dialedCount: numbers.length } });
          processed += numbers.length;
        }
      }
    }

    // ---- EMAIL: paced Zapmail batches ----
    if (wantsEmail && !c.emailDone) {
      const batch = await db.listContact.findMany({ where: { listId: c.listId, id: { gt: c.emailCursor }, ...stateWhere, email: { not: "" } }, orderBy: { id: "asc" }, take: Math.max(1, c.callsPerMin) });
      if (batch.length === 0) {
        await db.outreachCampaign.update({ where: { id: c.id }, data: { emailDone: true } });
      } else {
        for (const ct of batch) await sendCoreEmail(ct.email, c.emailSubject || "A quick note from us", emailHtml(c, ct.firstName), "campaign");
        await db.outreachCampaign.update({ where: { id: c.id }, data: { emailCursor: batch[batch.length - 1].id } });
        processed += batch.length;
      }
    }

    // ---- Finished? ----
    const voiceComplete = !wantsVoice || c.jdiDone;
    const emailComplete = !wantsEmail || c.emailDone;
    if (voiceComplete && emailComplete && !c.finishedAt) {
      await db.outreachCampaign.update({ where: { id: c.id }, data: { finishedAt: new Date() } }).catch(() => {});
    }
  }
  return { processed };
}
