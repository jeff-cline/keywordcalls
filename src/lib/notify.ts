import { getSettings } from "@/lib/settings";
import { getTwilioCfg, sendSms, placeCall } from "@/lib/twilio";
import { pushLeadToCore } from "@/lib/core";

// Alert the owner (Jeff) that a campaign went live / an event fired.
// Channels: Twilio SMS + Twilio voice call to notifyPhone, plus best-effort email via CORE.
// Never throws into a request — every channel is best-effort.
export async function notifyOwner(subject: string, lines: string[]): Promise<void> {
  const body = [subject, ...lines].filter(Boolean).join("\n");
  const s = await getSettings(["notifyPhone", "notifyFromNumber", "notifyEmail"]);
  const phone = s.notifyPhone || "9728006670";
  const from = s.notifyFromNumber || "+18006334427";
  const email = s.notifyEmail || "jeff.cline@me.com";

  const cfg = await getTwilioCfg();
  const jobs: Promise<unknown>[] = [];
  if (cfg && phone) {
    jobs.push(sendSms(phone, body.slice(0, 1500), from, cfg).catch(() => false));
    jobs.push(placeCall(phone, `${subject}. ${lines.join(". ")}`, from, cfg).catch(() => false));
  }
  // Email path (best-effort through CORE's notify/CRM).
  if (email) jobs.push(pushLeadToCore({ email, name: "Owner alert", notes: body, creatorRef: "keywordcalls-notify" }).catch(() => ({ ok: false })));
  await Promise.allSettled(jobs);
}
